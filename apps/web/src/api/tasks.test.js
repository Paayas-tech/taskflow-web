import { describe, expect, it } from "vitest";
import { rowToTask, taskPatchToApi, taskToRow, TASK_SELECT } from "./tasks";

const row = {
  id: "task-1",
  project_id: "project-1",
  title: "Write the spec",
  description: "Outline it",
  notes: "",
  priority: "high",
  status: "in_progress",
  work_type: "task",
  story_id: "story-1",
  column_id: "column-1",
  position: 2,
  due_date: "2026-03-01",
  start_time: "09:30:00",
  end_date: "2026-03-02",
  end_time: "10:45:00",
  reminder_enabled: true,
  reminder_at: "2026-03-01T08:00:00.000Z",
  completed_at: null,
  archived_at: null,
  created_at: "2026-02-01T00:00:00.000Z",
  updated_at: "2026-02-02T00:00:00.000Z",
  task_assignments: { user_id: "user-9", assigned_at: "2026-02-01T00:00:00.000Z" },
};

describe("TASK_SELECT", () => {
  it("asks for the assignment join", () => {
    expect(TASK_SELECT).toContain("task_assignments(user_id, assigned_at)");
  });
});

describe("rowToTask", () => {
  it("maps a project task row to the app shape", () => {
    expect(rowToTask(row)).toEqual({
      id: "task-1",
      projectId: "project-1",
      workType: "task",
      storyId: "story-1",
      title: "Write the spec",
      description: "Outline it",
      notes: "",
      status: "in-progress",
      completed: false,
      priority: "high",
      dueDate: "2026-03-01",
      endDate: "2026-03-02",
      startTime: "09:30",
      endTime: "10:45",
      reminder: true,
      reminderAt: "2026-03-01T08:00:00.000Z",
      columnId: "column-1",
      position: 2,
      assigneeId: "user-9",
      archivedAt: null,
      completedAt: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
  });

  it.each([
    ["done", "completed", true],
    ["in_progress", "in-progress", false],
    ["todo", "todo", false],
    [undefined, "todo", false],
  ])("maps the database status %s to %s", (dbStatus, status, completed) => {
    const task = rowToTask({ id: "t", status: dbStatus });
    expect(task.status).toBe(status);
    expect(task.completed).toBe(completed);
  });

  it("reads a single-day timed row back as no end date", () => {
    // The mirror of taskToRow: the app spells "ends the day it starts" as "".
    expect(
      rowToTask({
        id: "t",
        due_date: "2026-09-10",
        end_date: "2026-09-10",
        start_time: "10:00:00",
        end_time: "11:00:00",
      })
    ).toMatchObject({ dueDate: "2026-09-10", endDate: "", endTime: "11:00" });
  });

  it("reads the assignee from either relationship shape", () => {
    expect(rowToTask({ task_assignments: [{ user_id: "a" }] }).assigneeId).toBe("a");
    expect(rowToTask({ task_assignments: { user_id: "b" } }).assigneeId).toBe("b");
    expect(rowToTask({}).assigneeId).toBeNull();
  });

  it("defaults a personal task to empty scheduling values", () => {
    const task = rowToTask({ id: "t", project_id: null, position: null });
    expect(task).toMatchObject({
      projectId: null,
      columnId: null,
      position: null,
      dueDate: "",
      startTime: "",
      reminder: false,
      workType: "task",
    });
  });
});

describe("taskToRow", () => {
  it("round trips the fields rowToTask produced", () => {
    const task = rowToTask(row);
    expect(taskToRow(task)).toMatchObject({
      title: "Write the spec",
      description: "Outline it",
      priority: "high",
      status: "in_progress",
      work_type: "task",
      story_id: "story-1",
      project_id: "project-1",
      column_id: "column-1",
      position: 2,
      due_date: "2026-03-01",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      start_time: "09:30",
      end_time: "10:45",
      reminder_enabled: true,
      reminder_at: "2026-03-01T08:00:00.000Z",
    });
  });

  it("only maps the keys it was given", () => {
    expect(taskToRow({ title: "Renamed" })).toEqual({ title: "Renamed" });
  });

  it("ends a single-day timed item on its due date", () => {
    // tasks_end_time_requires_date rejects an end time with no end date, and
    // the app leaves endDate empty for an item that ends the day it starts.
    expect(
      taskToRow({
        dueDate: "2026-09-10",
        endDate: "",
        startTime: "10:00",
        endTime: "11:00",
      })
    ).toMatchObject({
      due_date: "2026-09-10",
      end_date: "2026-09-10",
      start_time: "10:00",
      end_time: "11:00",
    });
  });

  it("keeps an end date that spans more than one day", () => {
    expect(
      taskToRow({ dueDate: "2026-09-10", endDate: "2026-09-12", endTime: "11:00" })
    ).toMatchObject({ end_date: "2026-09-12" });
  });

  it("turns empty strings into nulls and keeps false and zero", () => {
    expect(taskToRow({
      dueDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      reminderAt: "",
      storyId: "",
      reminder: false,
      position: 0,
    })).toEqual({
      due_date: null,
      start_date: null,
      end_date: null,
      start_time: null,
      end_time: null,
      reminder_at: null,
      story_id: null,
      reminder_enabled: false,
      position: 0,
    });
  });

  it.each([
    ["completed", "done"],
    ["in-progress", "in_progress"],
    ["todo", "todo"],
    ["nonsense", "todo"],
  ])("maps the app status %s to %s", (status, expected) => {
    expect(taskToRow({ status }).status).toBe(expected);
  });

  it("never writes trigger-owned columns", () => {
    const patch = taskToRow({
      title: "Kept",
      version: 4,
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      assigneeId: "user-2",
    });
    expect(patch).toEqual({ title: "Kept" });
  });
});

describe("taskPatchToApi", () => {
  it("sends the completion mutation using the canonical API schema", () => {
    expect(taskPatchToApi({
      status: "done",
      completed: true,
      completedAt: "2026-09-27T10:00:00.000Z",
      columnId: "column-done",
    })).toEqual({
      status: "done",
      completed_at: "2026-09-27T10:00:00.000Z",
      columnId: "column-done",
    });
  });

  it("clears the completion timestamp when reopening", () => {
    expect(taskPatchToApi({
      status: "in-progress",
      completed: false,
      completedAt: null,
    })).toEqual({ status: "in_progress", completed_at: null });
  });
});
