import { describe, expect, it } from "vitest";
import {
  buildProjectTaskPlacements,
  columnIdFromProjectDnd,
  groupProjectTasksByColumn,
  taskIdFromProjectDnd,
} from "./projectBoardDomain";

const columns = [{ id: "todo" }, { id: "doing" }, { id: "done" }];
const tasks = [
  { id: "a", columnId: "todo", position: 0 },
  { id: "b", columnId: "todo", position: 1 },
  { id: "c", columnId: "doing", position: 0 },
  { id: "d", columnId: "done", position: 0 },
];

describe("project DnD identifier parsing", () => {
  it.each([
    ["task:alpha", "alpha"],
    ["task:", ""],
    [{ toString: () => "task:object" }, "object"],
  ])("parses task identifier %s", (value, expected) => {
    expect(taskIdFromProjectDnd(value)).toBe(expected);
  });

  it.each([undefined, null, false, 0, "column:alpha", "alpha", true])(
    "rejects invalid task identifier %s",
    (value) => expect(taskIdFromProjectDnd(value)).toBeNull()
  );

  it.each([
    ["column:alpha", "alpha"],
    ["column:", ""],
    [{ toString: () => "column:object" }, "object"],
  ])("parses column identifier %s", (value, expected) => {
    expect(columnIdFromProjectDnd(value)).toBe(expected);
  });

  it.each([undefined, null, false, 0, "task:alpha", "alpha", true])(
    "rejects invalid column identifier %s",
    (value) => expect(columnIdFromProjectDnd(value)).toBeNull()
  );
});

describe("groupProjectTasksByColumn", () => {
  it("creates groups in column order and handles empty inputs", () => {
    const groups = groupProjectTasksByColumn(columns, []);
    expect([...groups.keys()]).toEqual(["todo", "doing", "done"]);
    expect([...groups.values()]).toEqual([[], [], []]);
    expect(groupProjectTasksByColumn([], tasks).size).toBe(0);
  });

  it("groups known columns and falls unknown columns back to the first", () => {
    const unknown = { id: "unknown", columnId: "missing", position: 2 };
    const groups = groupProjectTasksByColumn(columns, [...tasks, unknown]);
    expect(groups.get("todo").map(({ id }) => id)).toEqual(["a", "b", "unknown"]);
    expect(groups.get("doing").map(({ id }) => id)).toEqual(["c"]);
  });

  it("sorts by position with missing positions treated as zero", () => {
    const unordered = [
      { id: "late", columnId: "todo", position: 4 },
      { id: "missing", columnId: "todo" },
      { id: "early", columnId: "todo", position: -1 },
      { id: "zero", columnId: "todo", position: 0 },
    ];
    expect(
      groupProjectTasksByColumn(columns, unordered).get("todo").map(({ id }) => id)
    ).toEqual(["early", "missing", "zero", "late"]);
  });

  it("does not mutate input arrays or task objects", () => {
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

  it("appends when dropped on a same-column target", () => {
    expect(build("a", "column:todo").slice(0, 2)).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
    ]);
  });

  it("inserts before a task in another column", () => {
    expect(build("b", "task:c")).toEqual([
      { taskId: "a", columnId: "todo", position: 0 },
      { taskId: "b", columnId: "doing", position: 0 },
      { taskId: "c", columnId: "doing", position: 1 },
      { taskId: "d", columnId: "done", position: 0 },
    ]);
  });

  it("appends when dropped on another column", () => {
    expect(build("a", "column:doing")).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "c", columnId: "doing", position: 0 },
      { taskId: "a", columnId: "doing", position: 1 },
      { taskId: "d", columnId: "done", position: 0 },
    ]);
  });

  it.each([
    ["missing moving task", "missing", "task:a"],
    ["missing drop target", "a", null],
  ])("returns null for %s", (_label, movingTaskId, overId) => {
    expect(build(movingTaskId, overId)).toBeNull();
  });

  it("preserves unknown task-target behavior by prepending to the first column", () => {
    expect(build("c", "task:missing").slice(0, 3)).toEqual([
      { taskId: "c", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
      { taskId: "b", columnId: "todo", position: 2 },
    ]);
  });

  it("preserves active-task-as-target behavior by moving it to index zero", () => {
    expect(build("b", "task:b").slice(0, 2)).toEqual([
      { taskId: "b", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
    ]);
  });

  it("returns complete sequential placements in stable column order", () => {
    expect(build("d", "task:a")).toEqual([
      { taskId: "d", columnId: "todo", position: 0 },
      { taskId: "a", columnId: "todo", position: 1 },
      { taskId: "b", columnId: "todo", position: 2 },
      { taskId: "c", columnId: "doing", position: 0 },
    ]);
  });

  it("does not mutate input arrays or task objects", () => {
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
