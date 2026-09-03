import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const taskModule = vi.hoisted(() => ({
  TaskRow: () => null,
  QuickAdd: () => null,
}));

vi.mock("../tasks", () => taskModule);

import { find, findAll, props, textContent } from "../test/elementTree";
import { EmptyState, SegmentedControl } from "../ui";
import MyTasksWidget from "./MyTasksWidget";
import { WidgetError, WidgetSkeleton } from "./Widget";

const todayKey = "2026-09-02";

const task = (overrides = {}) => ({
  id: "task",
  title: "Task",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: null,
  archivedAt: null,
  ...overrides,
});

const tasks = [
  task({ id: "1", title: "Ship release", dueDate: todayKey }),
  task({ id: "2", title: "Write notes", dueDate: "2026-09-04" }),
  task({ id: "3", title: "Fix billing", dueDate: "2026-08-28" }),
  task({ id: "4", title: "Someday", dueDate: "2026-11-01" }),
  task({ id: "5", title: "Done", dueDate: todayKey, completed: true, status: "completed" }),
];

const baseProps = (overrides = {}) => ({
  tasks,
  todayKey,
  taskActions: { pendingIds: new Set(), createPersonal: vi.fn(), toggleComplete: vi.fn() },
  onOpenTask: vi.fn(),
  onNewTask: vi.fn(),
  onNavigate: vi.fn(),
  ...overrides,
});

const rows = (tree) => findAll(tree, (node) => node.type === taskModule.TaskRow);
const rowTitles = (tree) => rows(tree).map((node) => props(node).task.title);
const segmented = (tree) => find(props(tree).actions, (node) => node.type === SegmentedControl);
const quickAdd = (tree) => find(props(tree).footer, (node) => node.type === taskModule.QuickAdd);

describe("MyTasksWidget", () => {
  it("opens on Today and counts every tab", () => {
    const tree = MyTasksWidget(baseProps());

    expect(props(tree).title).toBe("My tasks");
    expect(rowTitles(tree)).toEqual(["Ship release"]);
    expect(props(segmented(tree)).options).toEqual([
      { id: "today", label: "Today", count: 1 },
      { id: "upcoming", label: "Upcoming", count: 1 },
      { id: "overdue", label: "Overdue", count: 1 },
    ]);
  });

  it("switches to another tab", () => {
    const runner = runtime.createRunner(MyTasksWidget);
    const tree = runner.render(baseProps());

    props(segmented(tree)).onChange("overdue");
    const overdue = runner.render();

    expect(props(segmented(overdue)).value).toBe("overdue");
    expect(rowTitles(overdue)).toEqual(["Fix billing"]);
  });

  it("shows at most six rows", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      task({ id: `t${index}`, title: `Task ${index}`, dueDate: todayKey })
    );
    const tree = MyTasksWidget(baseProps({ tasks: many }));

    expect(rows(tree)).toHaveLength(6);
  });

  it("passes each row the shared context and the pending state", () => {
    const context = { projectsById: new Map() };
    const taskActions = {
      pendingIds: new Set(["1"]),
      createPersonal: vi.fn(),
      toggleComplete: vi.fn(),
    };
    const tree = MyTasksWidget(baseProps({ context, taskActions, selectedTaskId: "1" }));
    const row = props(rows(tree)[0]);

    expect(row.dense).toBe(true);
    expect(row.showProject).toBe(true);
    expect(row.context).toBe(context);
    expect(row.todayKey).toBe(todayKey);
    expect(row.busy).toBe(true);
    expect(row.selected).toBe(true);
    expect(row.onToggleComplete).toBe(taskActions.toggleComplete);
  });

  it("creates a personal task due today from the quick add", async () => {
    const widgetProps = baseProps();
    const tree = MyTasksWidget(widgetProps);

    expect(props(quickAdd(tree)).autoFocus).toBe(false);
    await props(quickAdd(tree)).onCreate("Call the vendor");

    expect(widgetProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Call the vendor",
      dueDate: todayKey,
    });
  });

  it("leaves the due date empty on the other tabs and hands the title to the composer", () => {
    const runner = runtime.createRunner(MyTasksWidget);
    const widgetProps = baseProps();
    const tree = runner.render(widgetProps);

    props(segmented(tree)).onChange("upcoming");
    const upcoming = runner.render();

    props(quickAdd(upcoming)).onCreate("Later task");
    expect(widgetProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Later task",
      dueDate: "",
    });

    props(quickAdd(upcoming)).onOpenDetails("Needs details");
    expect(widgetProps.onNewTask).toHaveBeenCalledWith({
      title: "Needs details",
      dueDate: "",
    });
  });

  it("links to My Tasks", () => {
    const widgetProps = baseProps();
    const tree = MyTasksWidget(widgetProps);
    const viewAll = find(
      props(tree).actions,
      (node) => textContent(node) === "View all" && props(node).variant === "ghost"
    );

    props(viewAll).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/tasks");
  });

  it("explains an empty tab but keeps the quick add", () => {
    const tree = MyTasksWidget(baseProps({ tasks: [] }));
    const empty = find(tree, (node) => node.type === EmptyState);

    expect(props(empty).title).toBe("Nothing due today");
    expect(quickAdd(tree)).toBeDefined();
  });

  it("shows a skeleton while loading and a retry notice when the load failed", () => {
    const loading = MyTasksWidget(baseProps({ loading: true }));
    expect(find(loading, (node) => node.type === WidgetSkeleton)).toBeDefined();
    expect(rows(loading)).toHaveLength(0);

    const onRetry = vi.fn();
    const failed = MyTasksWidget(baseProps({ error: "Tasks are unavailable.", onRetry }));
    const notice = find(failed, (node) => node.type === WidgetError);

    expect(props(notice).message).toBe("Tasks are unavailable.");
    expect(props(notice).onRetry).toBe(onRetry);
    expect(rows(failed)).toHaveLength(0);
  });
});
