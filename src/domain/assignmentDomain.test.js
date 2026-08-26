import { describe, expect, it } from "vitest";
import { sortAssignedTasksForAttention } from "./assignmentDomain";

const assignment = (overrides = {}) => ({
  id: "task-a",
  title: "Task",
  dueDate: "",
  priority: "medium",
  status: "todo",
  completed: false,
  archivedAt: null,
  projectStatus: "active",
  ...overrides,
});

describe("assigned task attention ordering", () => {
  it("orders overdue, today, upcoming, and undated assignments", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "undated" }),
        assignment({ id: "upcoming", dueDate: "2026-08-22" }),
        assignment({ id: "overdue", dueDate: "2026-08-19" }),
        assignment({ id: "today", dueDate: "2026-08-20" }),
      ],
      "2026-08-20"
    );

    expect(result.map(({ id }) => id)).toEqual([
      "overdue",
      "today",
      "upcoming",
      "undated",
    ]);
  });

  it("uses priority within the same date group", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "low", priority: "low" }),
        assignment({ id: "high", priority: "high" }),
      ],
      "2026-08-20"
    );

    expect(result.map(({ id }) => id)).toEqual(["high", "low"]);
  });

  it("excludes completed tasks, archived tasks, and archived projects", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "active" }),
        assignment({ id: "completed", status: "completed", completed: true }),
        assignment({ id: "archived-task", archivedAt: "2026-08-20T10:00:00.000Z" }),
        assignment({ id: "archived-project", projectStatus: "archived" }),
      ],
      "2026-08-20"
    );

    expect(result.map(({ id }) => id)).toEqual(["active"]);
  });

  it("returns an empty list safely", () => {
    expect(sortAssignedTasksForAttention([], "2026-08-20")).toEqual([]);
  });
});
