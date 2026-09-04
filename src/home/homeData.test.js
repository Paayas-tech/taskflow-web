import { describe, expect, it } from "vitest";
import { dateOnlyKey } from "../domain/task";
import {
  effectiveMyDayDate,
  homeTaskBuckets,
  latestNotifications,
  notificationText,
  recentProjects,
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
        task({
          id: "1",
          title: "Done",
          dueDate: todayKey,
          completed: true,
          status: "completed",
        }),
        task({
          id: "2",
          title: "Archived",
          dueDate: todayKey,
          archivedAt: "2026-09-01T10:00:00Z",
        }),
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

describe("recentProjects", () => {
  const projects = [
    { id: "a", name: "Apollo", updatedAt: "2026-08-01T00:00:00Z" },
    { id: "c", name: "Comet", updatedAt: "2026-09-02T00:00:00Z" },
    { id: "d", name: "Drift", updatedAt: null },
  ];

  it("sorts by last update and applies the limit without mutating the input", () => {
    expect(recentProjects(projects).map((project) => project.name)).toEqual([
      "Comet",
      "Apollo",
      "Drift",
    ]);
    expect(recentProjects(projects, 2).map((project) => project.name)).toEqual([
      "Comet",
      "Apollo",
    ]);
    expect(projects.map((project) => project.id)).toEqual(["a", "c", "d"]);
  });
});

describe("latestNotifications", () => {
  it("takes the newest notifications without mutating the input", () => {
    const notifications = [
      { id: "1", createdAt: "2026-09-01T09:00:00Z" },
      { id: "2", createdAt: "2026-09-02T09:00:00Z" },
      { id: "3", createdAt: "2026-08-30T09:00:00Z" },
    ];

    const newest = latestNotifications(notifications, 2);

    expect(newest.map((item) => item.id)).toEqual(["2", "1"]);
    expect(notifications.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});

describe("notificationText", () => {
  const notification = {
    id: "n1",
    type: "comment_added",
    data: { actorId: "user-2", taskTitle: "the brief" },
  };

  it("names the actor from the profile map", () => {
    expect(notificationText(notification, { "user-2": { displayName: "Ada" } })).toBe(
      "Ada added a comment to the brief."
    );
  });

  it("falls back to an unnamed actor when no profile is loaded", () => {
    expect(notificationText(notification, {})).toBe("added a comment to the brief.");
  });
});

describe("effectiveMyDayDate", () => {
  const at = (iso) => new Date(iso);
  const dayOf = dateOnlyKey;

  it("keeps the calendar day when the day resets at midnight", () => {
    const day = effectiveMyDayDate(at("2026-09-02T00:30:00"), { resetMode: "midnight" });
    expect(dayOf(day)).toBe("2026-09-02");
  });

  it("stays on the previous day until an early-morning reset", () => {
    const myDay = { resetMode: "early-morning", customResetTime: "06:00" };
    expect(dayOf(effectiveMyDayDate(at("2026-09-02T00:30:00"), myDay))).toBe("2026-09-01");
    expect(dayOf(effectiveMyDayDate(at("2026-09-02T05:59:00"), myDay))).toBe("2026-09-01");
    expect(dayOf(effectiveMyDayDate(at("2026-09-02T06:00:00"), myDay))).toBe("2026-09-02");
  });

  it("honours a custom reset time and leaves the clock time alone", () => {
    const myDay = { resetMode: "custom", customResetTime: "03:15" };
    const day = effectiveMyDayDate(at("2026-09-02T03:14:00"), myDay);
    expect(dayOf(day)).toBe("2026-09-01");
    expect(day.getHours()).toBe(3);
  });

  it("falls back to now for an unusable date", () => {
    expect(effectiveMyDayDate(new Date("nope"), {})).toBeInstanceOf(Date);
  });
});
