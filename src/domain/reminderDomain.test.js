import { describe, expect, it } from "vitest";
import {
  calculateReminderPreset,
  dateTimeLocalToIso,
  defaultReminderAt,
  formatReminderMetadata,
  getDueReminders,
  getReminderValidationError,
  isReminderDue,
  normalizeReminderAt,
  reminderNotificationKey,
  toDateTimeLocalValue,
} from "./reminderDomain";

const now = new Date("2026-08-14T10:00:00.000Z");

describe("reminder normalization and validation", () => {
  it("keeps legacy visual-only reminders compatible", () => {
    expect(
      getReminderValidationError({ reminder: true, reminderAt: "" }, { now })
    ).toBe("");
    expect(
      getReminderValidationError(
        { reminder: true, reminderAt: "" },
        { now, requireScheduled: true }
      )
    ).toMatch(/choose when/i);
  });

  it("normalizes ISO, local input, Date, and timestamp-like values", () => {
    const value = "2026-08-14T11:30:00.000Z";
    expect(normalizeReminderAt(value)).toBe(value);
    expect(normalizeReminderAt(new Date(value))).toBe(value);
    expect(normalizeReminderAt({ toDate: () => new Date(value) })).toBe(value);
    expect(dateTimeLocalToIso(toDateTimeLocalValue(value))).toBe(value);
    expect(normalizeReminderAt("not-a-date")).toBe("");
  });

  it("rejects invalid, past, and pre-creation reminders", () => {
    expect(
      getReminderValidationError(
        { reminder: true, reminderAt: "invalid" },
        { now }
      )
    ).toMatch(/valid reminder/i);
    expect(
      getReminderValidationError(
        { reminder: true, reminderAt: "2026-08-14T09:59:00.000Z" },
        { now }
      )
    ).toMatch(/future/i);
    expect(
      getReminderValidationError(
        {
          reminder: true,
          reminderAt: "2026-08-14T11:00:00.000Z",
          createdAt: "2026-08-14T11:30:00.000Z",
        },
        { now }
      )
    ).toMatch(/creation time/i);
  });
});

describe("reminder presets", () => {
  it("calculates task-time offsets", () => {
    const task = { dueDate: "2026-08-15", startTime: "12:00" };
    expect(calculateReminderPreset(task, "at-time", { now })).toBe(
      new Date("2026-08-15T12:00").toISOString()
    );
    expect(calculateReminderPreset(task, "15-minutes", { now })).toBe(
      new Date("2026-08-15T11:45").toISOString()
    );
    expect(calculateReminderPreset({}, "15-minutes", { now })).toBe("");
  });

  it("chooses a future default with or without a due date", () => {
    expect(defaultReminderAt({}, now)).toBe("2026-08-14T10:15:00.000Z");
    expect(defaultReminderAt({}, now, 30)).toBe("2026-08-14T10:30:00.000Z");
    const beforeTaskStart = new Date("2026-08-14T00:00:00.000Z");
    expect(
      defaultReminderAt(
        { dueDate: "2026-08-14", startTime: "12:00" },
        beforeTaskStart
      )
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

describe("due reminder selection", () => {
  const dueTask = {
    id: "due",
    title: "Due",
    reminder: true,
    reminderAt: "2026-08-14T09:59:00.000Z",
    completed: false,
  };

  it("selects due active reminders once", () => {
    expect(isReminderDue(dueTask, now)).toBe(true);
    expect(getDueReminders([dueTask], { now })).toEqual([dueTask]);
    expect(
      getDueReminders([dueTask], {
        now,
        notifiedIds: new Set([reminderNotificationKey(dueTask)]),
      })
    ).toEqual([]);
    expect(getDueReminders([{ ...dueTask, completed: true }], { now })).toEqual(
      []
    );
    expect(
      getDueReminders(
        [{ ...dueTask, archivedAt: "2026-08-14T09:30:00.000Z" }],
        { now }
      )
    ).toEqual([]);
  });

  it("formats upcoming, due, and legacy metadata", () => {
    expect(formatReminderMetadata("", now)).toBe("Reminder");
    expect(formatReminderMetadata(dueTask.reminderAt, now)).toBe("Reminder due");
    expect(
      formatReminderMetadata("2026-08-14T10:15:00.000Z", now)
    ).toBe("Reminds in 15 minutes");
  });
});
