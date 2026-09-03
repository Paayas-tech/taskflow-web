import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const taskModule = vi.hoisted(() => ({ TaskRow: () => null }));

vi.mock("../tasks", () => taskModule);

import { find, findAll, props, textContent } from "../test/elementTree";
import AssignedWidget from "./AssignedWidget";
import { WidgetError, WidgetSkeleton } from "./Widget";

const todayKey = "2026-09-02";
const userId = "user-1";

const task = (overrides = {}) => ({
  id: "task",
  title: "Task",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: "project-1",
  assigneeId: userId,
  archivedAt: null,
  ...overrides,
});

const tasks = [
  task({ id: "1", title: "No due date" }),
  task({ id: "2", title: "Overdue review", dueDate: "2026-08-30" }),
  task({ id: "3", title: "Due today", dueDate: todayKey }),
  task({ id: "4", title: "Someone else", assigneeId: "user-2" }),
  task({ id: "5", title: "Personal task", projectId: null }),
  task({ id: "6", title: "Finished", completed: true, status: "completed" }),
];

const baseProps = (overrides = {}) => ({
  tasks,
  userId,
  todayKey,
  taskActions: { pendingIds: new Set(), toggleComplete: vi.fn() },
  onOpenTask: vi.fn(),
  onNavigate: vi.fn(),
  ...overrides,
});

const rows = (tree) => findAll(tree, (node) => node.type === taskModule.TaskRow);
const rowTitles = (tree) => rows(tree).map((node) => props(node).task.title);

describe("AssignedWidget", () => {
  it("lists open project tasks assigned to the viewer, undated last", () => {
    const tree = AssignedWidget(baseProps());

    expect(props(tree).title).toBe("Assigned to me");
    expect(rowTitles(tree)).toEqual(["Overdue review", "Due today", "No due date"]);
  });

  it("shows the project on each dense row", () => {
    const context = { projectsById: new Map() };
    const tree = AssignedWidget(baseProps({ context, selectedTaskId: "2" }));
    const row = props(rows(tree)[0]);

    expect(row.dense).toBe(true);
    expect(row.showProject).toBe(true);
    expect(row.context).toBe(context);
    expect(row.selected).toBe(true);
    expect(row.onOpen).toBeTypeOf("function");
  });

  it("shows at most six rows", () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      task({ id: `t${index}`, title: `Task ${index}`, dueDate: todayKey })
    );

    expect(rows(AssignedWidget(baseProps({ tasks: many })))).toHaveLength(6);
  });

  it("falls back to any assigned project task when the viewer id is missing", () => {
    const tree = AssignedWidget(baseProps({ userId: undefined }));

    expect(rowTitles(tree)).toContain("Someone else");
    expect(rowTitles(tree)).not.toContain("Personal task");
  });

  it("says when nothing is assigned and links to My Tasks", () => {
    const widgetProps = baseProps({ tasks: [] });
    const tree = AssignedWidget(widgetProps);

    expect(textContent(find(tree, (node) => props(node).className === "widget-empty muted"))).toBe(
      "No project tasks are assigned to you."
    );

    props(find(props(tree).actions, (node) => textContent(node) === "View all")).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/tasks");
  });

  it("shows the loading and error states", () => {
    expect(
      find(AssignedWidget(baseProps({ loading: true })), (node) => node.type === WidgetSkeleton)
    ).toBeDefined();

    const failed = AssignedWidget(baseProps({ error: "Tasks are unavailable." }));
    expect(props(find(failed, (node) => node.type === WidgetError)).message).toBe(
      "Tasks are unavailable."
    );
    expect(rows(failed)).toHaveLength(0);
  });
});
