import { describe, expect, it, vi } from "vitest";
import {
  archiveTask,
  buildTaskEditPayload,
  buildCalendarMonthGrid,
  calendarTasks,
  calendarTasksByDate,
  calendarMonthStart,
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  filterTasks,
  filterTasksByProject,
  groupTasksForToday,
  isArchived,
  isTaskComplete,
  isValidDateOnly,
  isValidArchivedAt,
  localDateFromDateOnly,
  normalizeTaskDocument,
  normalizeTaskPriority,
  normalizeTaskStatus,
  resolveCompletionUpdate,
  shiftCalendarMonth,
  tasksForCalendarDate,
  tasksForCalendarMonth,
  taskFormValuesFromTask,
  taskMatchesSearch,
  upcomingCalendarTasks,
  unarchiveTask,
} from "./taskDomain";
import {
  getScheduleValidationError,
  normalizeTaskSchedule,
} from "./calendarDomain";

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
  listId: null,
  projectId: null,
  archivedAt: null,
  ...overrides,
});

describe("legacy task normalization", () => {
  it("fills every legacy default without inventing list or project links", () => {
    expect(normalizeTaskDocument("legacy", {})).toEqual({
      id: "legacy",
      title: "Untitled task",
      description: "",
      notes: "",
      status: "todo",
      completed: false,
      priority: "medium",
      dueDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      reminder: false,
      reminderAt: "",
      listId: null,
      projectId: null,
      createdAt: null,
      updatedAt: null,
      completedAt: null,
      archivedAt: null,
    });
  });

  it("normalizes legacy status and priority values", () => {
    const normalized = normalizeTaskDocument("legacy", {
      title: "Legacy",
      status: "In Progress",
      priority: "HIGH",
    });

    expect(normalized.status).toBe("in-progress");
    expect(normalized.priority).toBe("high");
    expect(normalized.completed).toBe(false);
    expect(normalizeTaskPriority("unexpected")).toBe("medium");
  });
});

describe("task archiving", () => {
  it("archives a task with the current ISO timestamp", () => {
    const archived = archiveTask(task(), () =>
      new Date("2026-08-14T10:30:00.000Z")
    );

    expect(archived.archivedAt).toBe("2026-08-14T10:30:00.000Z");
    expect(isArchived(archived)).toBe(true);
    expect(() => archiveTask(archived)).toThrow("already archived");
  });

  it("restores an archived task and rejects invalid transitions", () => {
    const archived = task({ archivedAt: "2026-08-14T10:30:00.000Z" });

    expect(unarchiveTask(archived).archivedAt).toBeNull();
    expect(() => unarchiveTask(task())).toThrow("not archived");
  });

  it("validates archive timestamps and treats legacy tasks as active", () => {
    expect(isValidArchivedAt("2026-08-14T10:30:00.000Z")).toBe(true);
    expect(isValidArchivedAt("August 14")).toBe(false);
    expect(isArchived({ title: "Legacy" })).toBe(false);
    expect(
      normalizeTaskDocument("invalid-archive", {
        title: "Invalid archive",
        archivedAt: "not-a-date",
      }).archivedAt
    ).toBeNull();
  });
});

describe("calendar schedule compatibility", () => {
  it("normalizes all-day, timed, and multi-day task schedules", () => {
    expect(normalizeTaskDocument("all-day", {
      dueDate: "2026-08-14",
    })).toMatchObject({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
    });

    expect(normalizeTaskDocument("timed", {
      dueDate: "2026-08-14",
      startTime: "09:30",
      endTime: "10:30",
    })).toMatchObject({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "09:30",
      endTime: "10:30",
      isAllDay: false,
    });

    expect(normalizeTaskDocument("multi-day", {
      dueDate: "2026-08-14",
      endDate: "2026-08-17",
    })).toMatchObject({
      dueDate: "2026-08-14",
      endDate: "2026-08-17",
      isAllDay: true,
    });
  });

  it("rejects invalid calendar date and time combinations", () => {
    expect(
      getScheduleValidationError({ dueDate: "2026-02-29" })
    ).toMatch(/valid YYYY-MM-DD/i);
    expect(
      getScheduleValidationError({
        dueDate: "2026-08-14",
        startTime: "09:00",
      })
    ).toMatch(/provided together/i);
    expect(() =>
      normalizeTaskSchedule(
        {
          dueDate: "2026-08-14",
          endDate: "2026-08-13",
        },
        { validate: true }
      )
    ).toThrow(/earlier/i);
  });
});

describe("status and completion synchronization", () => {
  it.each([
    ["progress", false, "in-progress"],
    ["done", false, "completed"],
    ["todo", true, "completed"],
    [undefined, false, "todo"],
  ])("normalizes status %s with completed=%s", (status, completed, expected) => {
    expect(normalizeTaskStatus(status, completed)).toBe(expected);
  });

  it("sets completedAt only when the resolved status is completed", () => {
    const timestampFactory = vi.fn(() => "server-time");

    expect(
      resolveCompletionUpdate({ status: "completed" }, timestampFactory)
    ).toEqual({
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
    expect(isTaskComplete(task({ status: "completed" }))).toBe(true);
    expect(isTaskComplete(task({ completed: true }))).toBe(true);
  });
});

describe("date-only helpers", () => {
  it("validates real local calendar dates", () => {
    expect(isValidDateOnly("2026-08-13")).toBe(true);
    expect(isValidDateOnly("2024-02-29")).toBe(true);
    expect(isValidDateOnly("2026-02-29")).toBe(false);
    expect(isValidDateOnly("08/13/2026")).toBe(false);
  });

  it("formats a local Date and compares date-only keys lexically", () => {
    expect(dateOnlyKey(new Date(2026, 7, 13))).toBe("2026-08-13");
    expect(compareDateOnly("2026-08-12", "2026-08-13")).toBe(-1);
    expect(compareDateOnly("2026-08-13", "2026-08-13")).toBe(0);
    expect(compareDateOnly("2026-08-14", "2026-08-13")).toBe(1);
    expect(classifyDateOnly("", "2026-08-13")).toBe("undated");
  });
});

describe("calendar helpers", () => {
  it("builds a stable six-week grid with correct weekday alignment", () => {
    const august = buildCalendarMonthGrid(new Date(2026, 7, 1));

    expect(august).toHaveLength(42);
    expect(august[0]).toEqual({
      key: "2026-07-26",
      day: 26,
      inCurrentMonth: false,
    });
    expect(august[6]).toEqual({
      key: "2026-08-01",
      day: 1,
      inCurrentMonth: true,
    });
    expect(august[41].key).toBe("2026-09-05");

    const mondayFirstAugust = buildCalendarMonthGrid(
      new Date(2026, 7, 1),
      1
    );
    expect(mondayFirstAugust[0].key).toBe("2026-07-27");
    expect(mondayFirstAugust[5].key).toBe("2026-08-01");
  });

  it("handles leap years and month shifts across year boundaries", () => {
    const february = buildCalendarMonthGrid(new Date(2024, 1, 1));
    expect(february.some(({ key }) => key === "2024-02-29")).toBe(true);
    expect(dateOnlyKey(shiftCalendarMonth(new Date(2026, 11, 1), 1))).toBe(
      "2027-01-01"
    );
    expect(dateOnlyKey(shiftCalendarMonth(new Date(2026, 0, 1), -1))).toBe(
      "2025-12-01"
    );
    expect(dateOnlyKey(calendarMonthStart(new Date(2026, 7, 13)))).toBe(
      "2026-08-01"
    );
    expect(dateOnlyKey(localDateFromDateOnly("2026-08-13"))).toBe(
      "2026-08-13"
    );
    expect(localDateFromDateOnly("2026-02-29")).toBeNull();
  });

  it("indexes only valid due dates and filters exact dates and months", () => {
    const candidates = [
      task({ id: "august-a", dueDate: "2026-08-13", projectId: "project-a" }),
      task({ id: "august-b", dueDate: "2026-08-31", listId: "work" }),
      task({ id: "september", dueDate: "2026-09-01" }),
      task({ id: "undated", dueDate: "" }),
      task({ id: "invalid", dueDate: "2026-02-29" }),
      task({
        id: "archived",
        dueDate: "2026-08-20",
        archivedAt: "2026-08-14T10:30:00.000Z",
      }),
    ];

    expect(calendarTasks(candidates).map(({ id }) => id)).toEqual([
      "august-a",
      "august-b",
      "september",
    ]);
    expect(
      calendarTasksByDate(candidates)
        .get("2026-08-13")
        .map(({ id }) => id)
    ).toEqual(["august-a"]);
    expect(
      tasksForCalendarDate(candidates, "2026-08-13").map(({ id }) => id)
    ).toEqual(["august-a"]);
    expect(
      tasksForCalendarMonth(candidates, new Date(2026, 7, 1)).map(
        ({ id }) => id
      )
    ).toEqual(["august-a", "august-b"]);
    expect(tasksForCalendarDate(candidates, "2026-08-13")[0]).toMatchObject({
      projectId: "project-a",
      listId: null,
    });
  });

  it("returns sorted active upcoming tasks after the visible month", () => {
    const candidates = [
      task({ id: "october", dueDate: "2026-10-01" }),
      task({ id: "september", dueDate: "2026-09-01" }),
      task({ id: "completed", dueDate: "2026-09-02", completed: true }),
      task({ id: "current", dueDate: "2026-08-31" }),
    ];

    expect(
      upcomingCalendarTasks(candidates, new Date(2026, 7, 1), 2).map(
        ({ id }) => id
      )
    ).toEqual(["september", "october"]);
  });
});

describe("Today grouping", () => {
  const todayKey = "2026-08-13";
  const tasks = [
    task({ id: "overdue-later", dueDate: "2026-08-12" }),
    task({ id: "overdue-earlier", dueDate: "2026-08-10" }),
    task({ id: "today", dueDate: todayKey }),
    task({ id: "upcoming", dueDate: "2026-08-14" }),
    task({ id: "undated", dueDate: "" }),
    task({ id: "completed-past", dueDate: "2026-08-11", completed: true }),
    task({ id: "completed-undated", completed: true }),
    task({ id: "completed-future", dueDate: "2026-08-15", completed: true }),
    task({
      id: "archived-today",
      dueDate: todayKey,
      archivedAt: "2026-08-14T10:30:00.000Z",
    }),
  ];

  it("groups overdue, today, upcoming, undated, and relevant completed tasks", () => {
    const groups = groupTasksForToday(tasks, todayKey);

    expect(groups.overdue.map(({ id }) => id)).toEqual([
      "overdue-earlier",
      "overdue-later",
    ]);
    expect(groups.today.map(({ id }) => id)).toEqual(["today"]);
    expect(groups.upcoming.map(({ id }) => id)).toEqual(["upcoming"]);
    expect(groups.undated.map(({ id }) => id)).toEqual(["undated"]);
    expect(groups.completed.map(({ id }) => id)).toEqual([
      "completed-past",
      "completed-undated",
    ]);
  });
});

describe("task search and filtering", () => {
  const tasks = [
    task({ id: "title", title: "Write launch notes", listId: "work" }),
    task({ id: "description", title: "Call", description: "Launch partner" }),
    task({ id: "notes", title: "Review", notes: "LAUNCH assets" }),
    task({ id: "missing", title: "Quiet", description: undefined, notes: null }),
  ];

  it("matches title, description, and notes safely and case-insensitively", () => {
    expect(tasks.filter((item) => taskMatchesSearch(item, "launch")).map(({ id }) => id)).toEqual([
      "title",
      "description",
      "notes",
    ]);
    expect(taskMatchesSearch(tasks[3], "launch")).toBe(false);
  });

  it("combines list, status, priority, date, reminder, and completion filters", () => {
    const candidates = [
      task({
        id: "match",
        title: "Launch checklist",
        listId: "work",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-08-12",
        reminder: true,
      }),
      task({ id: "wrong-list", listId: "personal", dueDate: "2026-08-12" }),
      task({ id: "completed", listId: "work", dueDate: "2026-08-12", completed: true }),
      task({ id: "inbox", listId: "missing" }),
      task({
        id: "archived-match",
        title: "Launch checklist",
        listId: "work",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-08-12",
        reminder: true,
        archivedAt: "2026-08-14T10:30:00.000Z",
      }),
    ];

    const result = filterTasks(candidates, {
      selectedListKey: "work",
      knownListIds: new Set(["work", "personal"]),
      searchTerm: "launch",
      status: "in-progress",
      priority: "high",
      dueDate: "overdue",
      reminder: "enabled",
      completion: "active",
      todayKey: "2026-08-13",
    });

    expect(result.map(({ id }) => id)).toEqual(["match"]);
    expect(
      filterTasks(candidates, {
        selectedListKey: "inbox",
        knownListIds: new Set(["work", "personal"]),
        todayKey: "2026-08-13",
      }).map(({ id }) => id)
    ).toEqual(["inbox"]);
  });
});

describe("task editing and project scoping", () => {
  it("excludes project tasks from every personal-list filter", () => {
    const projectTask = task({
      id: "project-task",
      projectId: "project-a",
      listId: "work",
      dueDate: "2026-08-13",
      completed: true,
      status: "completed",
    });
    const personalTask = task({ id: "personal-task", listId: "work" });
    const filters = [
      { selectedListKey: "all" },
      { selectedListKey: "work", knownListIds: new Set(["work"]) },
      { selectedListKey: "all", dueDate: "today", todayKey: "2026-08-13" },
      { selectedListKey: "all", completion: "completed" },
    ];

    filters.forEach((options) => {
      expect(filterTasks([projectTask, personalTask], options)).not.toContain(projectTask);
    });
  });

  it("preserves projectId when building edit form values and payloads", () => {
    const values = taskFormValuesFromTask(
      task({ projectId: "project-a", listId: "work" }),
      [{ id: "work" }]
    );

    expect(values.projectId).toBe("project-a");
    expect(buildTaskEditPayload(values).projectId).toBe("project-a");
    expect(buildTaskEditPayload(values)).toMatchObject({
      dueDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
    });
    expect(buildTaskEditPayload({ ...values, projectId: "" }).projectId).toBeNull();
  });

  it("preserves timed multi-day fields in edit form values and payloads", () => {
    const values = taskFormValuesFromTask(
      task({
        dueDate: "2026-08-14",
        endDate: "2026-08-15",
        startTime: "16:00",
        endTime: "11:00",
      })
    );

    expect(buildTaskEditPayload(values)).toMatchObject({
      dueDate: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "16:00",
      endTime: "11:00",
    });
  });

  it("normalizes and preserves scheduled reminders in edit payloads", () => {
    const reminderAt = "2026-08-14T11:30:00.000Z";
    const normalized = normalizeTaskDocument("scheduled", {
      title: "Scheduled reminder",
      reminder: true,
      reminderAt,
    });
    const values = taskFormValuesFromTask(normalized);
    const payload = buildTaskEditPayload(values);

    expect(normalized.reminderAt).toBe(reminderAt);
    expect(payload).toMatchObject({ reminder: true, reminderAt });
  });

  it("returns only tasks whose projectId exactly matches", () => {
    const tasks = [
      task({ id: "exact", projectId: "project-a" }),
      task({ id: "other", projectId: "project-b" }),
      task({ id: "prefix", projectId: "project-a-extra" }),
      task({ id: "none", projectId: null }),
      task({
        id: "archived-project",
        projectId: "project-a",
        archivedAt: "2026-08-14T10:30:00.000Z",
      }),
    ];

    expect(filterTasksByProject(tasks, "project-a").map(({ id }) => id)).toEqual([
      "exact",
    ]);
  });
});
