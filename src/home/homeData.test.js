import { describe, expect, it } from "vitest";
import {
  activeProjects,
  assignedHomeTasks,
  homeTaskBuckets,
  latestNotifications,
  recentProjects,
  shiftDateKey,
} from "./homeData";

const todayKey = "2026-09-02";

const task = (overrides = {}) => ({
  id: "task",
  title: "Task",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: null,
  assigneeId: null,
  archivedAt: null,
  ...overrides,
});

const titles = (tasks) => tasks.map((item) => item.title);

describe("shiftDateKey", () => {
  it("moves a date-only key across a month boundary", () => {
    expect(shiftDateKey("2026-08-30", 7)).toBe("2026-09-06");
    expect(shiftDateKey("2026-09-02", -1)).toBe("2026-09-01");
  });

  it("returns the input when it is not a date-only key", () => {
    expect(shiftDateKey("", 7)).toBe("");
    expect(shiftDateKey("tomorrow", 7)).toBe("tomorrow");
  });
});

describe("homeTaskBuckets", () => {
  it("splits open tasks into today, upcoming and overdue", () => {
    const buckets = homeTaskBuckets(
      [
        task({ id: "1", title: "Today", dueDate: todayKey }),
        task({ id: "2", title: "Soon", dueDate: "2026-09-05" }),
        task({ id: "3", title: "Horizon", dueDate: "2026-09-09" }),
        task({ id: "4", title: "Beyond", dueDate: "2026-09-10" }),
        task({ id: "5", title: "Late", dueDate: "2026-08-28" }),
        task({ id: "6", title: "Undated" }),
      ],
      todayKey
    );

    expect(titles(buckets.today)).toEqual(["Today"]);
    expect(titles(buckets.upcoming)).toEqual(["Soon", "Horizon"]);
    expect(titles(buckets.overdue)).toEqual(["Late"]);
  });

  it("drops completed and archived tasks", () => {
    const buckets = homeTaskBuckets(
      [
        task({ id: "1", title: "Done", dueDate: todayKey, completed: true, status: "completed" }),
        task({ id: "2", title: "Archived", dueDate: todayKey, archivedAt: "2026-09-01T10:00:00Z" }),
        task({ id: "3", title: "Open", dueDate: todayKey }),
      ],
      todayKey
    );

    expect(titles(buckets.today)).toEqual(["Open"]);
  });

  it("orders each bucket by due date, then priority, then title", () => {
    const buckets = homeTaskBuckets(
      [
        task({ id: "1", title: "Low today", dueDate: todayKey, priority: "low" }),
        task({ id: "2", title: "High today", dueDate: todayKey, priority: "high" }),
        task({ id: "3", title: "Alpha", dueDate: "2026-09-04" }),
        task({ id: "4", title: "Earlier", dueDate: "2026-09-03" }),
      ],
      todayKey
    );

    expect(titles(buckets.today)).toEqual(["High today", "Low today"]);
    expect(titles(buckets.upcoming)).toEqual(["Earlier", "Alpha"]);
  });
});

describe("assignedHomeTasks", () => {
  const userId = "user-1";

  it("keeps open project tasks assigned to the viewer, most urgent first", () => {
    const assigned = assignedHomeTasks(
      [
        task({ id: "1", title: "Undated", projectId: "p1", assigneeId: userId }),
        task({ id: "2", title: "Overdue", projectId: "p1", assigneeId: userId, dueDate: "2026-08-30" }),
        task({ id: "3", title: "Today", projectId: "p1", assigneeId: userId, dueDate: todayKey }),
        task({ id: "4", title: "Someone else", projectId: "p1", assigneeId: "user-2" }),
        task({ id: "5", title: "Personal", assigneeId: userId }),
        task({
          id: "6",
          title: "Finished",
          projectId: "p1",
          assigneeId: userId,
          completed: true,
          status: "completed",
        }),
      ],
      userId,
      todayKey
    );

    expect(titles(assigned)).toEqual(["Overdue", "Today", "Undated"]);
  });

  it("falls back to any assigned project task when the viewer is unknown", () => {
    const assigned = assignedHomeTasks(
      [
        task({ id: "1", title: "Assigned", projectId: "p1", assigneeId: "user-2" }),
        task({ id: "2", title: "Unassigned", projectId: "p1" }),
      ],
      undefined,
      todayKey
    );

    expect(titles(assigned)).toEqual(["Assigned"]);
  });
});

describe("project and notification helpers", () => {
  const projects = [
    { id: "a", name: "Apollo", status: "active", updatedAt: "2026-08-01T00:00:00Z" },
    { id: "b", name: "Bee", status: "archived", updatedAt: "2026-09-01T00:00:00Z" },
    { id: "c", name: "Comet", status: "active", updatedAt: "2026-09-02T00:00:00Z" },
    { id: "d", name: "Drift", status: "active", updatedAt: null },
  ];

  it("keeps only active projects", () => {
    expect(activeProjects(projects).map((project) => project.name)).toEqual([
      "Apollo",
      "Comet",
      "Drift",
    ]);
  });

  it("sorts active projects by last update and applies the limit", () => {
    expect(recentProjects(projects).map((project) => project.name)).toEqual([
      "Comet",
      "Apollo",
      "Drift",
    ]);
    expect(recentProjects(projects, 2).map((project) => project.name)).toEqual([
      "Comet",
      "Apollo",
    ]);
  });

  it("takes the newest notifications without mutating the input", () => {
    const notifications = [
      { id: "1", createdAt: "2026-09-01T09:00:00Z" },
      { id: "2", createdAt: "2026-09-02T09:00:00Z" },
      { id: "3", createdAt: "2026-08-30T09:00:00Z" },
    ];

    expect(latestNotifications(notifications, 2).map((item) => item.id)).toEqual(["2", "1"]);
    expect(notifications.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});
