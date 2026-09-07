import { describe, expect, it } from "vitest";
import {
  buildProjectTaskPlacements,
  groupProjectTasksByColumn,
  mapPersonalTasksToBoard,
  personalTaskMoveUpdate,
  taskIdFromProjectDnd,
} from "./board";

const columns = [{ id: "todo" }, { id: "doing" }, { id: "done" }];
const tasks = [
  { id: "a", columnId: "todo", position: 0 },
  { id: "b", columnId: "todo", position: 1 },
  { id: "c", columnId: "doing", position: 0 },
  { id: "d", columnId: "done", position: 0 },
];

const ids = (entries) => entries.map(({ id }) => id);

describe("personal board", () => {
  it("derives a column and a position from task status", () => {
    expect(
      mapPersonalTasksToBoard([
        { id: "a", status: "todo", completed: false },
        { id: "b", status: "in-progress", completed: false },
        { id: "c", status: "todo", completed: true },
      ])
    ).toEqual([
      expect.objectContaining({ id: "a", columnId: "todo", position: 0 }),
      expect.objectContaining({ id: "b", columnId: "in-progress", position: 1 }),
      expect.objectContaining({ id: "c", columnId: "completed", position: 2 }),
    ]);
  });

  it("builds the task update for a cross-column move", () => {
    const boardTasks = mapPersonalTasksToBoard([
      { id: "a", status: "todo", completed: false },
    ]);

    expect(
      personalTaskMoveUpdate(boardTasks, [
        { taskId: "a", columnId: "completed", position: 0 },
      ])
    ).toEqual({
      taskId: "a",
      changes: { status: "completed", completed: true },
    });
  });

  it("ignores same-column reordering because personal tasks have no order", () => {
    const boardTasks = mapPersonalTasksToBoard([
      { id: "a", status: "todo", completed: false },
    ]);

    expect(
      personalTaskMoveUpdate(boardTasks, [
        { taskId: "a", columnId: "todo", position: 2 },
      ])
    ).toBeNull();
  });
});

describe("project drag identifiers", () => {
  it.each([
    ["task:alpha", "alpha"],
    ["task:", ""],
    [{ toString: () => "task:object" }, "object"],
  ])("parses task identifier %s", (value, expected) => {
    expect(taskIdFromProjectDnd(value)).toBe(expected);
  });

  it.each([undefined, null, false, 0, "column:alpha", "alpha", true])(
    "rejects invalid task identifier %s",
    (value) => {
      expect(taskIdFromProjectDnd(value)).toBeNull();
    }
  );
});

describe("groupProjectTasksByColumn", () => {
  it("creates groups in column order and handles empty inputs", () => {
    const groups = groupProjectTasksByColumn(columns, []);

    expect([...groups.keys()]).toEqual(["todo", "doing", "done"]);
    expect([...groups.values()]).toEqual([[], [], []]);
    expect(groupProjectTasksByColumn([], tasks).size).toBe(0);
  });

  it("falls an unknown column back to the first column", () => {
    const unknown = { id: "unknown", columnId: "missing", position: 2 };
    const groups = groupProjectTasksByColumn(columns, [...tasks, unknown]);

    expect(ids(groups.get("todo"))).toEqual(["a", "b", "unknown"]);
    expect(ids(groups.get("doing"))).toEqual(["c"]);
  });

  it("sorts by position with missing positions treated as zero", () => {
    const unordered = [
      { id: "late", columnId: "todo", position: 4 },
      { id: "missing", columnId: "todo" },
      { id: "early", columnId: "todo", position: -1 },
      { id: "zero", columnId: "todo", position: 0 },
    ];

    expect(ids(groupProjectTasksByColumn(columns, unordered).get("todo"))).toEqual([
      "early",
      "missing",
      "zero",
      "late",
    ]);
  });

  it("does not mutate the input arrays or task objects", () => {
    const inputColumns = columns.map((column) => ({ ...column }));
    const inputTasks = [
      { id: "late", columnId: "todo", position: 2 },
      { id: "early", columnId: "todo", position: 1 },
    ];
    const columnSnapshot = structuredClone(inputColumns);
    const taskSnapshot = structuredClone(inputTasks);
    const groups = groupProjectTasksByColumn(inputColumns, inputTasks);

    expect(inputColumns).toEqual(columnSnapshot);
    expect(inputTasks).toEqual(taskSnapshot);
    expect(groups.get("todo")[0]).toBe(inputTasks[1]);
  });

  it("preserves the given order and uses the status column when asked", () => {
    const categorized = [
      { id: "todo", category: "todo" },
      { id: "doing", category: "in_progress" },
      { id: "done", category: "done" },
    ];
    const orderedForList = [
      { id: "newer", columnId: "todo", position: 8 },
      { id: "done", columnId: "done", position: 0 },
      { id: "older", columnId: "todo", position: 1 },
      { id: "status-fallback", columnId: "missing", status: "in-progress" },
    ];

    const groups = groupProjectTasksByColumn(categorized, orderedForList, {
      preserveTaskOrder: true,
    });

    expect(ids(groups.get("todo"))).toEqual(["newer", "older"]);
    expect(ids(groups.get("doing"))).toEqual(["status-fallback"]);
    expect([...groups.values()].flat()).toHaveLength(orderedForList.length);
  });
});

describe("buildProjectTaskPlacements", () => {
  const build = (movingTaskId, overId, inputTasks = tasks) =>
    buildProjectTaskPlacements({ columns, tasks: inputTasks, movingTaskId, overId });

  it("inserts before another task in the same column", () => {
    expect(build("b", "task:a")).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
      { taskId: "c", columnId: "doing", position: 0 },
      { taskId: "d", columnId: "done", position: 0 },
    ]);
  });

  it("appends when dropped on a column", () => {
    expect(build("a", "column:todo").slice(0, 2)).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
    ]);
    expect(build("a", "column:doing")).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "c", columnId: "doing", position: 0 },
      { taskId: "a", columnId: "doing", position: 1 },
      { taskId: "d", columnId: "done", position: 0 },
    ]);
  });

  it("inserts before a task in another column and renumbers every column", () => {
    expect(build("b", "task:c")).toEqual([
      { taskId: "a", columnId: "todo", position: 0 },
      { taskId: "b", columnId: "doing", position: 0 },
      { taskId: "c", columnId: "doing", position: 1 },
      { taskId: "d", columnId: "done", position: 0 },
    ]);
    expect(build("d", "task:a")).toEqual([
      { taskId: "d", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
      { taskId: "b", columnId: "todo", position: 2 },
      { taskId: "c", columnId: "doing", position: 0 },
    ]);
  });

  it.each([
    ["missing moving task", "missing", "task:a"],
    ["missing drop target", "a", null],
  ])("returns null for %s", (_label, movingTaskId, overId) => {
    expect(build(movingTaskId, overId)).toBeNull();
  });

  it("prepends to the first column when the drop target is unknown", () => {
    expect(build("c", "task:missing").slice(0, 3)).toEqual([
      { taskId: "c", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
      { taskId: "b", columnId: "todo", position: 2 },
    ]);
  });

  it("moves a task dropped on itself to index zero", () => {
    expect(build("b", "task:b").slice(0, 2)).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
    ]);
  });

  it("does not mutate the input arrays or task objects", () => {
    const inputColumns = columns.map((column) => ({ ...column }));
    const inputTasks = tasks.map((task) => ({ ...task }));
    const columnsSnapshot = structuredClone(inputColumns);
    const tasksSnapshot = structuredClone(inputTasks);

    buildProjectTaskPlacements({
      columns: inputColumns,
      tasks: inputTasks,
      movingTaskId: "a",
      overId: "column:doing",
    });

    expect(inputColumns).toEqual(columnsSnapshot);
    expect(inputTasks).toEqual(tasksSnapshot);
  });
});
