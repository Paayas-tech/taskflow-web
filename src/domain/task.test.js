import { describe, expect, it, vi } from "vitest";
import {
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  dueDateTone,
  filterArchivedTasks,
  formatDueLabel,
  formatOverviewDate,
  getScheduleValidationError,
  groupTasksBy,
  groupTasksByDue,
  isArchived,
  isTaskComplete,
  isValidDateOnly,
  localDateFromDateOnly,
  normalizeProjectHealth,
  normalizeTaskPriority,
  normalizeTaskSchedule,
  normalizeTaskStatus,
  priorityLabel,
  resolveCompletionUpdate,
  shiftDateOnly,
  sortAssignedTasksForAttention,
  sortTasks,
  sortTasksNewestFirst,
  statusLabel,
  taskFormValuesFromTask,
  taskSearchMatch,
  timeToMinutes,
} from "./task";

const todayKey = "2026-09-02";

const task = (overrides = {}) => ({
  id: "task-1",
  title: "Plan launch",
  description: "Prepare the release checklist",
  notes: "Ask design for final assets",
  status: "todo",
  completed: false,
  priority: "medium",
  dueDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  reminder: false,
  reminderAt: "",
  projectId: null,
  archivedAt: null,
  ...overrides,
});

const ids = (tasks) => tasks.map(({ id }) => id);

describe("date-only helpers", () => {
  it.each([
    ["2026-08-13", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["08/13/2026", false],
    ["", false],
  ])("validates %s as %s", (value, expected) => {
    expect(isValidDateOnly(value)).toBe(expected);
  });

  it("formats a local Date and compares keys lexically", () => {
    expect(dateOnlyKey(new Date(2026, 7, 13))).toBe("2026-08-13");
    expect(compareDateOnly("2026-08-12", "2026-08-13")).toBe(-1);
    expect(compareDateOnly("2026-08-13", "2026-08-13")).toBe(0);
    expect(compareDateOnly("2026-08-14", "2026-08-13")).toBe(1);
  });

  it("reads a date-only key back as a local midnight Date", () => {
    expect(dateOnlyKey(localDateFromDateOnly("2026-08-13"))).toBe("2026-08-13");
    expect(localDateFromDateOnly("2026-02-29")).toBeNull();
  });

  it("shifts across month and year boundaries and rejects other input", () => {
    expect(shiftDateOnly("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDateOnly("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftDateOnly("tomorrow", 7)).toBe("");
  });

  it.each([
    ["", "undated"],
    ["2026-09-01", "overdue"],
    ["2026-09-02", "today"],
    ["2026-09-03", "upcoming"],
  ])("classifies %s as %s", (value, expected) => {
    expect(classifyDateOnly(value, todayKey)).toBe(expected);
  });

  it("converts valid 24-hour times to minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBeNull();
  });
});

describe("task schedules", () => {
  it("normalizes all-day, timed and multi-day schedules", () => {
    expect(normalizeTaskSchedule({ dueDate: "2026-08-14" })).toEqual({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
    });
    expect(
      normalizeTaskSchedule({
        dueDate: "2026-08-14",
        startTime: "09:30",
        endTime: "10:30",
      }).isAllDay
    ).toBe(false);
  });

  it.each([
    [{ dueDate: "2026-02-29" }, /valid YYYY-MM-DD/i],
    [{ dueDate: "", startTime: "09:00", endTime: "10:00" }, /start date/i],
    [{ dueDate: "2026-08-14", startTime: "09:00" }, /provided together/i],
    [
      { dueDate: "2026-08-14", startTime: "10:00", endTime: "09:00" },
      /later than start time/i,
    ],
    [{ dueDate: "2026-08-14", endDate: "2026-08-13" }, /earlier/i],
  ])("rejects %o", (schedule, pattern) => {
    expect(getScheduleValidationError(schedule)).toMatch(pattern);
  });

  it("accepts an overnight range that spans two days", () => {
    expect(
      getScheduleValidationError({
        dueDate: "2026-08-14",
        endDate: "2026-08-15",
        startTime: "16:00",
        endTime: "11:00",
      })
    ).toBe("");
  });

  it("throws only when validation is requested", () => {
    expect(() =>
      normalizeTaskSchedule({ dueDate: "2026-08-14", endDate: "2026-08-13" })
    ).not.toThrow();
    expect(() =>
      normalizeTaskSchedule(
        { dueDate: "2026-08-14", endDate: "2026-08-13" },
        { validate: true }
      )
    ).toThrow(/earlier/i);
  });
});

describe("status, priority and labels", () => {
  it.each([
    ["progress", false, "in-progress"],
    ["done", false, "completed"],
    ["todo", true, "completed"],
    [undefined, false, "todo"],
  ])("normalizes status %s with completed=%s", (status, completed, expected) => {
    expect(normalizeTaskStatus(status, completed)).toBe(expected);
  });

  it("normalizes unknown priorities to medium", () => {
    expect(normalizeTaskPriority("HIGH")).toBe("high");
    expect(normalizeTaskPriority("unexpected")).toBe("medium");
  });

  it.each([
    ["todo", "To do"],
    ["in-progress", "In progress"],
    ["in_progress", "In progress"],
    ["completed", "Done"],
    ["done", "Done"],
    ["unknown", "To do"],
  ])("labels status %s as %s", (status, expected) => {
    expect(statusLabel(status)).toBe(expected);
  });

  it("labels priorities in sentence case", () => {
    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel(undefined)).toBe("Medium");
  });
});

describe("completion and archiving", () => {
  it("treats either completion signal as done", () => {
    expect(isTaskComplete(task({ status: "completed" }))).toBe(true);
    expect(isTaskComplete(task({ completed: true }))).toBe(true);
    expect(isTaskComplete(task())).toBe(false);
  });

  it("treats an unparsable archivedAt as active", () => {
    expect(isArchived({ archivedAt: "August 14" })).toBe(false);
    expect(isArchived({ title: "Legacy" })).toBe(false);
  });

  it("keeps only archived tasks, newest first", () => {
    const tasks = [
      task({ id: "active" }),
      task({ id: "older", archivedAt: "2026-08-12T09:00:00.000Z" }),
      task({ id: "newer", archivedAt: "2026-08-14T09:00:00.000Z" }),
      { id: "legacy", title: "Legacy task" },
    ];

    expect(ids(filterArchivedTasks(tasks))).toEqual(["newer", "older"]);
  });

  it("sets completedAt only when the resolved status is completed", () => {
    const timestampFactory = vi.fn(() => "server-time");

    expect(resolveCompletionUpdate({ status: "completed" }, timestampFactory)).toEqual({
      status: "completed",
      completed: true,
      completedAt: "server-time",
    });
    expect(timestampFactory).toHaveBeenCalledOnce();

    expect(
      resolveCompletionUpdate(
        { status: "completed", completed: false },
        timestampFactory
      )
    ).toEqual({ status: "todo", completed: false, completedAt: null });
    expect(timestampFactory).toHaveBeenCalledOnce();
  });

  it("does not add completion fields to unrelated updates", () => {
    expect(resolveCompletionUpdate({ title: "Renamed" })).toEqual({});
  });
});

describe("sorting and form values", () => {
  it("orders tasks newest first, undated last", () => {
    const tasks = [
      task({ id: "undated", createdAt: null }),
      task({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      task({ id: "new", createdAt: "2026-05-01T00:00:00.000Z" }),
    ];

    expect(ids(sortTasksNewestFirst(tasks))).toEqual(["new", "old", "undated"]);
  });

  it("seeds form values from a task, keeping project, schedule and reminder", () => {
    const scheduled = task({
      title: "Scheduled",
      projectId: "project-a",
      dueDate: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "16:00",
      endTime: "11:00",
      reminder: true,
      reminderAt: "2026-08-14T11:30:00.000Z",
    });

    expect(taskFormValuesFromTask(scheduled)).toMatchObject({
      title: "Scheduled",
      projectId: "project-a",
      dueDate: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "16:00",
      endTime: "11:00",
      reminder: true,
      workType: "task",
      storyId: "",
    });
    expect(taskFormValuesFromTask(task()).projectId).toBe("");
  });
});

describe("due-date presentation", () => {
  it.each([
    ["", "none"],
    ["2026-09-01", "overdue"],
    ["2026-09-02", "today"],
    ["2026-09-09", "soon"],
    ["2026-09-10", "later"],
  ])("tones %s as %s", (dueDate, expected) => {
    expect(dueDateTone(dueDate, todayKey)).toBe(expected);
  });

  it("never marks completed work overdue", () => {
    expect(dueDateTone("2026-09-01", todayKey, true)).toBe("later");
  });

  it.each([
    ["", ""],
    ["2026-09-02", "Today"],
    ["2026-09-03", "Tomorrow"],
    ["2026-09-01", "Yesterday"],
  ])("labels %s as %s", (dueDate, expected) => {
    expect(formatDueLabel(dueDate, todayKey)).toBe(expected);
  });

  it("adds the year only outside the current year", () => {
    expect(formatDueLabel("2026-08-12", todayKey)).not.toContain("2026");
    expect(formatDueLabel("2027-08-12", todayKey)).toContain("2027");
  });
});

describe("grouping", () => {
  it("orders the due sections and always keeps Today", () => {
    expect(groupTasksByDue([], todayKey).map((group) => group.id)).toEqual([
      "today",
    ]);

    const groups = groupTasksByDue(
      [
        task({ id: "later", dueDate: "2026-10-01" }),
        task({ id: "overdue", dueDate: "2026-08-30" }),
        task({ id: "today", dueDate: todayKey }),
        task({ id: "soon", dueDate: "2026-09-04" }),
        task({ id: "none" }),
        task({
          id: "done",
          status: "completed",
          completed: true,
          completedAt: "2026-09-01T10:00:00.000Z",
        }),
      ],
      todayKey
    );

    expect(groups.map((group) => group.id)).toEqual([
      "overdue",
      "today",
      "upcoming",
      "later",
      "none",
      "completed",
    ]);
    expect(ids(groups.find((group) => group.id === "upcoming").tasks)).toEqual([
      "soon",
    ]);
    expect(groups.find((group) => group.id === "completed").tasks).toHaveLength(1);
  });

  it("orders priority groups from high to low", () => {
    const groups = groupTasksBy(
      [task({ id: "a", priority: "low" }), task({ id: "b", priority: "high" })],
      "priority"
    );

    expect(groups.map((group) => group.label)).toEqual(["High", "Low"]);
  });

  it("names project groups from the context and keeps personal work last", () => {
    const groups = groupTasksBy(
      [task({ id: "a" }), task({ id: "b", projectId: "project-1" })],
      "project",
      { projectsById: new Map([["project-1", { id: "project-1", name: "Launch" }]]) }
    );

    expect(groups.map((group) => group.label)).toEqual(["Launch", "Personal"]);
  });

  it("labels assignees by display name without exposing the user id", () => {
    const assigneeId = "11111111-1111-4111-8111-111111111111";
    const groups = groupTasksBy(
      [task({ id: "a", assigneeId }), task({ id: "b" })],
      "assignee",
      {
        membersById: new Map([
          [assigneeId, { userId: assigneeId, displayName: "Alex Member" }],
        ]),
      }
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Alex Member",
      "Unassigned",
    ]);
  });
});

describe("sorting and search", () => {
  it("puts undated tasks after dated ones and never mutates the input", () => {
    const tasks = [
      task({ id: "none" }),
      task({ id: "late", dueDate: "2026-09-20" }),
      task({ id: "soon", dueDate: "2026-09-03" }),
    ];

    expect(ids(sortTasks(tasks, "due"))).toEqual(["soon", "late", "none"]);
    expect(ids(tasks)).toEqual(["none", "late", "soon"]);
  });

  it("sorts by priority, title and created date", () => {
    expect(
      ids(
        sortTasks([task({ id: "m" }), task({ id: "h", priority: "high" })], "priority")
      )
    ).toEqual(["h", "m"]);
    expect(
      ids(
        sortTasks(
          [task({ id: "b", title: "Beta" }), task({ id: "a", title: "Alpha" })],
          "title"
        )
      )
    ).toEqual(["a", "b"]);
    expect(
      ids(
        sortTasks(
          [
            task({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
            task({ id: "new", createdAt: "2026-05-01T00:00:00.000Z" }),
          ],
          "created"
        )
      )
    ).toEqual(["new", "old"]);
  });

  it("matches title, description, notes, project and story case-insensitively", () => {
    const candidate = task({
      title: "Review release",
      description: "Check the changelog",
      notes: null,
      projectName: "Launch",
      storyName: "Billing",
    });

    expect(taskSearchMatch(candidate, "")).toBe(true);
    expect(taskSearchMatch(candidate, "RELEASE")).toBe(true);
    expect(taskSearchMatch(candidate, "changelog")).toBe(true);
    expect(taskSearchMatch(candidate, "launch")).toBe(true);
    expect(taskSearchMatch(candidate, "billing")).toBe(true);
    expect(taskSearchMatch(candidate, "invoice")).toBe(false);
  });
});

describe("assigned task ordering", () => {
  const assignment = (overrides = {}) =>
    task({ projectStatus: "active", ...overrides });

  it("orders overdue, today, upcoming and undated assignments", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "undated" }),
        assignment({ id: "upcoming", dueDate: "2026-09-04" }),
        assignment({ id: "overdue", dueDate: "2026-09-01" }),
        assignment({ id: "today", dueDate: todayKey }),
      ],
      todayKey
    );

    expect(ids(result)).toEqual(["overdue", "today", "upcoming", "undated"]);
  });

  it("uses priority within the same date group", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "low", priority: "low" }),
        assignment({ id: "high", priority: "high" }),
      ],
      todayKey
    );

    expect(ids(result)).toEqual(["high", "low"]);
  });

  it("excludes completed tasks, archived tasks and archived projects", () => {
    const result = sortAssignedTasksForAttention(
      [
        assignment({ id: "active" }),
        assignment({ id: "completed", status: "completed", completed: true }),
        assignment({
          id: "archived-task",
          archivedAt: "2026-09-01T10:00:00.000Z",
        }),
        assignment({ id: "archived-project", projectStatus: "archived" }),
      ],
      todayKey
    );

    expect(ids(result)).toEqual(["active"]);
    expect(sortAssignedTasksForAttention([], todayKey)).toEqual([]);
  });

  it("appends completed tasks newest first when includeCompleted is set", () => {
    const done = (id, completedAt) =>
      assignment({ id, status: "completed", completed: true, completedAt });
    const result = sortAssignedTasksForAttention(
      [
        done("completed-older", "2026-08-18T09:00:00.000Z"),
        assignment({ id: "open", dueDate: todayKey }),
        done("completed-newer", "2026-08-19T09:00:00.000Z"),
        done("completed-undated", null),
        done("archived", "2026-08-20T09:00:00.000Z"),
      ].map((entry) =>
        entry.id === "archived"
          ? { ...entry, archivedAt: "2026-08-20T10:00:00.000Z" }
          : entry
      ),
      todayKey,
      { includeCompleted: true }
    );

    expect(ids(result)).toEqual([
      "open",
      "completed-newer",
      "completed-older",
      "completed-undated",
    ]);
  });
});

describe("project overview helpers", () => {
  it("falls back to on track for an unknown health value", () => {
    expect(normalizeProjectHealth("at_risk")).toBe("at_risk");
    expect(normalizeProjectHealth("unknown")).toBe("on_track");
  });

  it("formats or dashes an overview date", () => {
    expect(formatOverviewDate("")).toBe("—");
    expect(formatOverviewDate("not-a-date")).toBe("—");
    expect(formatOverviewDate("2026-08-15T00:00:00.000Z")).toContain("2026");
  });
});
