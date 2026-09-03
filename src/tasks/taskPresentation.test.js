import { describe, expect, it } from "vitest";
import {
  dueDateTone,
  formatDueLabel,
  groupTasksBy,
  groupTasksByDue,
  priorityLabel,
  sortTasks,
  statusLabel,
  taskSearchMatch,
} from "./taskPresentation";

const todayKey = "2026-09-02";

const task = (overrides = {}) => ({
  id: "task-1",
  title: "Review release",
  description: "",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: null,
  ...overrides,
});

describe("taskPresentation labels", () => {
  it("names statuses and priorities in sentence case", () => {
    expect(statusLabel("todo")).toBe("To do");
    expect(statusLabel("in-progress")).toBe("In progress");
    expect(statusLabel("completed")).toBe("Done");
    expect(statusLabel("unknown")).toBe("To do");

    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel("low")).toBe("Low");
    expect(priorityLabel(undefined)).toBe("Medium");
  });
});

describe("dueDateTone", () => {
  it("separates overdue, today, the next week and later", () => {
    expect(dueDateTone("", todayKey)).toBe("none");
    expect(dueDateTone("2026-09-01", todayKey)).toBe("overdue");
    expect(dueDateTone("2026-09-02", todayKey)).toBe("today");
    expect(dueDateTone("2026-09-09", todayKey)).toBe("soon");
    expect(dueDateTone("2026-09-10", todayKey)).toBe("later");
  });

  it("never marks completed work overdue", () => {
    expect(dueDateTone("2026-09-01", todayKey, true)).toBe("later");
  });
});

describe("formatDueLabel", () => {
  it("uses relative words for the days around today", () => {
    expect(formatDueLabel("", todayKey)).toBe("");
    expect(formatDueLabel("2026-09-02", todayKey)).toBe("Today");
    expect(formatDueLabel("2026-09-03", todayKey)).toBe("Tomorrow");
    expect(formatDueLabel("2026-09-01", todayKey)).toBe("Yesterday");
  });

  it("adds the year only outside the current year", () => {
    expect(formatDueLabel("2026-08-12", todayKey)).not.toContain("2026");
    expect(formatDueLabel("2027-08-12", todayKey)).toContain("2027");
  });
});

describe("groupTasksByDue", () => {
  it("orders the sections and always keeps Today", () => {
    const groups = groupTasksByDue([], todayKey);

    expect(groups.map((group) => group.id)).toEqual(["today"]);
    expect(groups[0].label).toBe("Today");
  });

  it("splits tasks by tone, excludes completed work and appends it last", () => {
    const groups = groupTasksByDue(
      [
        task({ id: "later", dueDate: "2026-10-01" }),
        task({ id: "overdue", dueDate: "2026-08-30" }),
        task({ id: "today", dueDate: todayKey }),
        task({ id: "soon", dueDate: "2026-09-04" }),
        task({ id: "none" }),
        task({ id: "done", status: "completed", completed: true, completedAt: "2026-09-01T10:00:00.000Z" }),
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
    expect(groups.find((group) => group.id === "completed").tasks).toHaveLength(1);
    expect(groups.find((group) => group.id === "upcoming").tasks[0].id).toBe("soon");
  });
});

describe("groupTasksBy", () => {
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
      { membersById: new Map([[assigneeId, { userId: assigneeId, displayName: "Alex Member" }]]) }
    );

    expect(groups.map((group) => group.label)).toEqual(["Alex Member", "Unassigned"]);
  });
});

describe("sortTasks", () => {
  it("puts undated tasks after dated ones", () => {
    const sorted = sortTasks(
      [task({ id: "none" }), task({ id: "late", dueDate: "2026-09-20" }), task({ id: "soon", dueDate: "2026-09-03" })],
      "due"
    );

    expect(sorted.map((entry) => entry.id)).toEqual(["soon", "late", "none"]);
  });

  it("sorts by priority, title and created date", () => {
    expect(
      sortTasks([task({ id: "m" }), task({ id: "h", priority: "high" })], "priority").map(
        (entry) => entry.id
      )
    ).toEqual(["h", "m"]);

    expect(
      sortTasks([task({ id: "b", title: "Beta" }), task({ id: "a", title: "Alpha" })], "title").map(
        (entry) => entry.id
      )
    ).toEqual(["a", "b"]);

    expect(
      sortTasks(
        [
          task({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
          task({ id: "new", createdAt: "2026-05-01T00:00:00.000Z" }),
        ],
        "created"
      ).map((entry) => entry.id)
    ).toEqual(["new", "old"]);
  });

  it("does not mutate the input", () => {
    const tasks = [task({ id: "b", title: "Beta" }), task({ id: "a", title: "Alpha" })];
    sortTasks(tasks, "title");

    expect(tasks.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

describe("taskSearchMatch", () => {
  it("matches the title, description, project and story", () => {
    const candidate = task({
      title: "Review release",
      description: "Check the changelog",
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
