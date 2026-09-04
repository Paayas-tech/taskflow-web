import { describe, expect, it } from "vitest";
import {
  calculateReminderPreset,
  dateTimeLocalToIso,
  defaultReminderAt,
  formatReminderMetadata,
  getDueReminders,
  getReminderValidationError,
  normalizeReminderAt,
  reminderNotificationKey,
  toDateTimeLocalValue,
} from "./reminder";

const now = new Date("2026-08-14T10:00:00.000Z");

describe("reminder values", () => {
  it("normalizes ISO, local input, Date and timestamp-like values", () => {
    const value = "2026-08-14T11:30:00.000Z";

    expect(normalizeReminderAt(value)).toBe(value);
    expect(normalizeReminderAt(new Date(value))).toBe(value);
    expect(normalizeReminderAt({ toDate: () => new Date(value) })).toBe(value);
    expect(dateTimeLocalToIso(toDateTimeLocalValue(value))).toBe(value);
    expect(normalizeReminderAt("not-a-date")).toBe("");
    expect(dateTimeLocalToIso("2026-08-14")).toBe("");
  });
});

describe("reminder validation", () => {
  it("keeps a visual-only reminder valid unless a time is required", () => {
    expect(getReminderValidationError({ reminder: true, reminderAt: "" }, { now })).toBe(
      ""
    );
    expect(
      getReminderValidationError(
        { reminder: true, reminderAt: "" },
        { now, requireScheduled: true }
      )
    ).toMatch(/choose when/i);
  });

  it.each([
    ["invalid", {}, /valid reminder/i],
    ["2026-08-14T09:59:00.000Z", {}, /future/i],
    [
      "2026-08-14T11:00:00.000Z",
      { createdAt: "2026-08-14T11:30:00.000Z" },
      /creation time/i,
    ],
  ])("rejects %s", (reminderAt, extra, pattern) => {
    expect(
      getReminderValidationError({ reminder: true, reminderAt, ...extra }, { now })
    ).toMatch(pattern);
  });

  it("ignores everything when the reminder is off", () => {
    expect(
      getReminderValidationError({ reminder: false, reminderAt: "invalid" }, { now })
    ).toBe("");
  });
});

describe("reminder presets and defaults", () => {
  it("calculates offsets from the task start time", () => {
    const task = { dueDate: "2026-08-15", startTime: "12:00" };

    expect(calculateReminderPreset(task, "at-time", { now })).toBe(
      new Date("2026-08-15T12:00").toISOString()
    );
    expect(calculateReminderPreset(task, "15-minutes", { now })).toBe(
      new Date("2026-08-15T11:45").toISOString()
    );
    expect(calculateReminderPreset({}, "15-minutes", { now })).toBe("");
    expect(calculateReminderPreset(task, "next-week", { now })).toBe("");
  });

  it("chooses a future default with or without a due date", () => {
    expect(defaultReminderAt({}, now)).toBe("2026-08-14T10:15:00.000Z");
    expect(defaultReminderAt({}, now, 30)).toBe("2026-08-14T10:30:00.000Z");

    const beforeTaskStart = new Date("2026-08-14T00:00:00.000Z");
    expect(
      defaultReminderAt({ dueDate: "2026-08-14", startTime: "12:00" }, beforeTaskStart)
    ).toBe(new Date("2026-08-14T11:45").toISOString());
    expect(
      defaultReminderAt(
        { dueDate: "2026-08-14", startTime: "12:00" },
        beforeTaskStart,
        60
      )
    ).toBe(new Date("2026-08-14T11:00").toISOString());
  });
});

describe("due reminders", () => {
  const dueTask = {
    id: "due",
    title: "Due",
    reminder: true,
    reminderAt: "2026-08-14T09:59:00.000Z",
    completed: false,
  };

  it("selects a due active reminder exactly once", () => {
    expect(getDueReminders([dueTask], { now })).toEqual([dueTask]);
    expect(
      getDueReminders([dueTask], {
        now,
        notifiedIds: new Set([reminderNotificationKey(dueTask)]),
      })
    ).toEqual([]);
  });

  it.each([
    ["completed", { completed: true }],
    ["archived", { archivedAt: "2026-08-14T09:30:00.000Z" }],
    ["not due yet", { reminderAt: "2026-08-14T10:30:00.000Z" }],
    ["reminder off", { reminder: false }],
  ])("skips a %s task", (_label, overrides) => {
    expect(getDueReminders([{ ...dueTask, ...overrides }], { now })).toEqual([]);
  });

  it("formats upcoming and overdue reminder metadata", () => {
    expect(formatReminderMetadata("", now)).toBe("Reminder");
    expect(formatReminderMetadata(dueTask.reminderAt, now)).toBe("Reminder due");
    expect(formatReminderMetadata("2026-08-14T10:15:00.000Z", now)).toBe(
      "Reminds in 15 minutes"
    );
  });
});
