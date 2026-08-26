import { describe, expect, it } from "vitest";
import {
  mapPersonalTasksToBoard,
  personalTaskColumnId,
  personalTaskMoveUpdate,
} from "./personalTaskBoardDomain";

describe("personal task board domain", () => {
  it("maps active and completed task states to their board columns", () => {
    expect(personalTaskColumnId({ status: "todo", completed: false })).toBe("todo");
    expect(personalTaskColumnId({ status: "in-progress", completed: false })).toBe("in-progress");
    expect(personalTaskColumnId({ status: "todo", completed: true })).toBe("completed");
  });

  it("adds stable board placement data without changing task identity", () => {
    expect(mapPersonalTasksToBoard([{ id: "a", status: "todo" }, { id: "b", status: "in-progress" }])).toEqual([
      expect.objectContaining({ id: "a", columnId: "todo", position: 0 }),
      expect.objectContaining({ id: "b", columnId: "in-progress", position: 1 }),
    ]);
  });

  it("builds the existing task update payload for a cross-column move", () => {
    const boardTasks = mapPersonalTasksToBoard([{ id: "a", status: "todo", completed: false }]);
    expect(personalTaskMoveUpdate(boardTasks, [{ taskId: "a", columnId: "completed", position: 0 }])).toEqual({
      taskId: "a",
      changes: { status: "completed", completed: true },
    });
  });

  it("ignores same-column reordering because personal tasks have no ordering field", () => {
    const boardTasks = mapPersonalTasksToBoard([{ id: "a", status: "todo", completed: false }]);
    expect(personalTaskMoveUpdate(boardTasks, [{ taskId: "a", columnId: "todo", position: 2 }])).toBeNull();
  });
});
