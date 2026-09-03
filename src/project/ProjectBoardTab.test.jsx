import { beforeEach, describe, expect, it, vi } from "vitest";

const taskComponents = vi.hoisted(() => ({ boards: [], bulkBars: [] }));

vi.mock("../tasks", () => ({
  BulkActionBar: (barProps) => {
    taskComponents.bulkBars.push(barProps);
    return null;
  },
  TaskBoard: (boardProps) => {
    taskComponents.boards.push(boardProps);
    return null;
  },
}));

import { BulkActionBar, TaskBoard } from "../tasks";
import { find, props, render, textContent } from "../test/elementTree";
import { ProjectBoardTab } from "./ProjectBoardTab";

const columns = [
  { id: "todo", name: "To do", category: "todo" },
  { id: "doing", name: "Doing", category: "in_progress" },
];

const tasks = [
  { id: "task-a", title: "Plan launch", columnId: "todo" },
  { id: "task-b", title: "Ship launch", columnId: "doing" },
];

const baseProps = (overrides = {}) => ({
  columns,
  tasks,
  context: { projectsById: new Map(), membersById: new Map() },
  onMove: vi.fn(),
  onOpen: vi.fn(),
  onQuickCreate: vi.fn(),
  readOnly: false,
  selectedTaskId: null,
  selectable: false,
  selectedIds: new Set(),
  allSelected: false,
  onToggleSelect: vi.fn(),
  onToggleAll: vi.fn(),
  bulkBusy: false,
  bulkMessage: null,
  members: [{ userId: "user-a", displayName: "Priya Shah" }],
  stories: [{ id: "story-a", title: "Launch prep" }],
  currentStoryId: "story-a",
  onBulkAction: vi.fn(),
  onClearSelection: vi.fn(),
  todayKey: "2026-09-02",
  ...overrides,
});

const boardProps = (tree) => props(find(tree, (node) => node.type === TaskBoard));
const bulkProps = (tree) => props(find(tree, (node) => node.type === BulkActionBar));

beforeEach(() => {
  taskComponents.boards.length = 0;
  taskComponents.bulkBars.length = 0;
});

describe("ProjectBoardTab", () => {
  it("hands the project columns, tasks and handlers to the shared board", () => {
    const componentProps = baseProps();
    const tree = ProjectBoardTab(componentProps);

    expect(boardProps(tree)).toEqual(
      expect.objectContaining({
        columns,
        tasks,
        readOnly: false,
        selectable: false,
        todayKey: "2026-09-02",
        onMove: componentProps.onMove,
        onOpen: componentProps.onOpen,
        onQuickCreate: componentProps.onQuickCreate,
      })
    );
  });

  it("shows an empty state instead of a board when the project has no columns", () => {
    const tree = ProjectBoardTab(baseProps({ columns: [] }));

    expect(find(tree, (node) => node.type === TaskBoard)).toBeUndefined();
    expect(textContent(render(tree, 4))).toContain("No columns yet");
  });

  it("hides the bulk strip until selection is enabled", () => {
    expect(find(ProjectBoardTab(baseProps()), (node) => node.type === BulkActionBar)).toBeUndefined();

    const tree = ProjectBoardTab(baseProps({ selectable: true }));
    expect(bulkProps(tree)).toEqual(
      expect.objectContaining({ selectedCount: 0, currentStoryId: "story-a" })
    );
    expect(boardProps(tree).selectable).toBe(true);
  });

  it("marks the select-all checkbox mixed for a partial selection", () => {
    const partial = render(
      ProjectBoardTab(
        baseProps({ selectable: true, selectedIds: new Set(["task-a"]), allSelected: false })
      ),
      4
    );
    const partialCheckbox = find(partial, (node) => node.type === "input");
    expect(props(partialCheckbox)["aria-checked"]).toBe("mixed");
    expect(props(partialCheckbox).checked).toBe(false);

    const all = render(
      ProjectBoardTab(
        baseProps({
          selectable: true,
          selectedIds: new Set(["task-a", "task-b"]),
          allSelected: true,
        })
      ),
      4
    );
    expect(props(find(all, (node) => node.type === "input"))["aria-checked"]).toBe(true);
  });

  it("hands the board an Add details handler that opens the project composer", () => {
    const onOpenComposer = vi.fn();
    const tree = ProjectBoardTab(baseProps({ onOpenComposer }));
    const board = props(find(tree, (node) => node.type === TaskBoard));

    board.onOpenDetails("Draft the brief", columns[1]);
    expect(onOpenComposer).toHaveBeenCalledWith({
      title: "Draft the brief",
      column: columns[1],
    });
  });

  it("omits the Add details handler when no composer is wired", () => {
    const tree = ProjectBoardTab(baseProps());
    expect(props(find(tree, (node) => node.type === TaskBoard)).onOpenDetails).toBeUndefined();
  });

  it("renders the bulk result message with the matching tone", () => {
    const success = render(
      ProjectBoardTab(baseProps({ bulkMessage: { error: false, text: "2 tasks updated." } })),
      4
    );
    expect(textContent(success)).toContain("2 tasks updated.");
    expect(props(find(success, (node) => props(node).role === "status")).role).toBe("status");

    const failure = render(
      ProjectBoardTab(baseProps({ bulkMessage: { error: true, text: "1 failed." } })),
      4
    );
    expect(props(find(failure, (node) => props(node).role === "alert")).role).toBe("alert");
  });
});
