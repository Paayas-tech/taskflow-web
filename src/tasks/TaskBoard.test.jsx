import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const dnd = vi.hoisted(() => ({ droppable: { isOver: false } }));

vi.mock("@dnd-kit/core", () => ({
  closestCorners: "closest-corners",
  DndContext: ({ children }) => children,
  DragOverlay: ({ children }) => children,
  KeyboardSensor: "keyboard-sensor",
  PointerSensor: "pointer-sensor",
  useDroppable: () => ({ setNodeRef: () => {}, isOver: dnd.droppable.isOver }),
  useSensor: (sensor, options) => ({ sensor, options }),
  useSensors: (...sensors) => sensors,
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }) => children,
  sortableKeyboardCoordinates: "keyboard-coordinates",
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: "vertical",
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { BoardColumn, TaskBoard } from "./TaskBoard";

const columns = [
  { id: "col-todo", name: "To do", category: "todo" },
  { id: "col-done", name: "Done", category: "done" },
];

const tasks = [
  { id: "task-1", title: "Draft plan", status: "todo", priority: "medium", columnId: "col-todo", position: 0 },
  { id: "task-2", title: "Ship it", status: "completed", completed: true, priority: "low", columnId: "col-done", position: 0 },
];

const boardProps = (overrides = {}) => ({ columns, tasks, todayKey: "2026-09-02", ...overrides });

describe("TaskBoard", () => {
  it("renders one column per status with its task count", () => {
    const runner = runtime.createRunner(TaskBoard);
    const tree = render(runner.render(boardProps()), 3);
    const headings = findAll(tree, (node) => props(node).className === "board-column-name");

    expect(headings.map((heading) => textContent(heading))).toEqual(["To do", "Done"]);
    expect(
      findAll(tree, (node) => props(node).className === "board-column-count").map((node) =>
        textContent(node)
      )
    ).toEqual(["1", "1"]);
  });

  it("moves a task by handing placements to onMove", async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const runner = runtime.createRunner(TaskBoard);
    const context = runner.render(boardProps({ onMove }));

    props(context).onDragStart({ active: { id: "task:task-1" } });
    props(context).onDragEnd({ active: { id: "task:task-1" }, over: { id: "column:col-done" } });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toContainEqual({
      taskId: "task-1",
      columnId: "col-done",
      position: 1,
    });
  });

  it("ignores drops in a read-only project", () => {
    const onMove = vi.fn();
    const runner = runtime.createRunner(TaskBoard);
    const context = runner.render(boardProps({ onMove, readOnly: true }));

    props(context).onDragEnd({ active: { id: "task:task-1" }, over: { id: "column:col-done" } });

    expect(onMove).not.toHaveBeenCalled();
  });

  it("collapses the columns it is told to start collapsed", () => {
    const runner = runtime.createRunner(TaskBoard);
    const tree = render(
      runner.render(boardProps({ collapsible: true, initiallyCollapsedIds: ["col-done"] })),
      3
    );
    const collapsed = findAll(tree, (node) =>
      String(props(node).className || "").includes("board-column")
    ).filter((node) => String(props(node).className || "").includes("is-collapsed"));

    expect(collapsed).toHaveLength(1);
    expect(textContent(collapsed[0])).toContain("Done");
    expect(textContent(collapsed[0])).not.toContain("Ship it");
  });
});

describe("BoardColumn", () => {
  const columnProps = (overrides = {}) => ({
    column: columns[0],
    tasks: [tasks[0]],
    ...overrides,
  });

  it("offers quick create from the header and the footer trigger", () => {
    const onStartQuickCreate = vi.fn();
    const tree = render(
      BoardColumn(columnProps({ onQuickCreate: vi.fn(), onStartQuickCreate })),
      3
    );
    const addButton = find(tree, (node) => props(node)["aria-label"] === "Add task to To do");

    expect(addButton).toBeTruthy();
    addButton.props.onClick();
    expect(onStartQuickCreate).toHaveBeenCalledWith(columns[0]);

    const trigger = find(tree, (node) => props(node).className === "quick-add-trigger");
    trigger.props.onClick();
    expect(onStartQuickCreate).toHaveBeenCalledTimes(2);
  });

  it("swaps the trigger for an inline quick add and forwards the column", async () => {
    const onQuickCreate = vi.fn().mockResolvedValue(undefined);
    const tree = BoardColumn(columnProps({ onQuickCreate, quickCreateActive: true }));
    const quickAdd = find(tree, (node) => props(node).contextLabel === "To do");

    expect(quickAdd).toBeTruthy();
    await props(quickAdd).onCreate("New task");
    expect(onQuickCreate).toHaveBeenCalledWith("New task", columns[0]);
  });

  it("offers Add details on the column quick add when onOpenDetails is given", async () => {
    const onOpenDetails = vi.fn();
    const tree = BoardColumn(
      columnProps({ onQuickCreate: vi.fn(), onOpenDetails, quickCreateActive: true })
    );
    const quickAdd = find(tree, (node) => props(node).contextLabel === "To do");

    await props(quickAdd).onOpenDetails("Draft the brief");
    expect(onOpenDetails).toHaveBeenCalledWith("Draft the brief", columns[0]);
  });

  it("leaves the quick add without Add details when no handler is given", () => {
    const tree = BoardColumn(columnProps({ onQuickCreate: vi.fn(), quickCreateActive: true }));
    const quickAdd = find(tree, (node) => props(node).contextLabel === "To do");

    expect(props(quickAdd).onOpenDetails).toBeUndefined();
  });

  it("hides every create control for viewers", () => {
    const tree = render(BoardColumn(columnProps({ onQuickCreate: vi.fn(), readOnly: true })), 3);

    expect(find(tree, (node) => props(node)["aria-label"] === "Add task to To do")).toBeUndefined();
    expect(find(tree, (node) => props(node).className === "quick-add-trigger")).toBeUndefined();
  });

  it("marks the column while a card is dragged over it", () => {
    dnd.droppable.isOver = true;
    const tree = BoardColumn(columnProps());
    dnd.droppable.isOver = false;

    expect(props(tree).className).toContain("is-over");
  });
});
