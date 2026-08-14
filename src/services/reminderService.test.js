import { describe, expect, it, vi } from "vitest";
import { createReminderScheduler } from "./reminderService";

const dueTask = {
  id: "task-1",
  title: "Review release",
  reminder: true,
  reminderAt: "2026-08-14T09:59:00.000Z",
  dueDate: "2026-08-14",
  startTime: "11:00",
};

describe("reminder scheduler", () => {
  it("uses the in-app fallback and does not notify twice", () => {
    const fallback = vi.fn();
    const scheduler = createReminderScheduler({
      getTasks: () => [dueTask],
      onInAppReminder: fallback,
      now: () => new Date("2026-08-14T10:00:00.000Z"),
      notificationApi: null,
    });

    expect(scheduler.check()).toEqual([dueTask]);
    expect(scheduler.check()).toEqual([]);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("delivers a browser notification when permission is granted", () => {
    const createdNotifications = [];
    class NotificationMock {
      static permission = "granted";
      constructor(title, options) {
        this.title = title;
        this.options = options;
        createdNotifications.push(this);
      }
    }
    const fallback = vi.fn();
    const scheduler = createReminderScheduler({
      getTasks: () => [dueTask],
      onInAppReminder: fallback,
      now: () => new Date("2026-08-14T10:00:00.000Z"),
      notificationApi: NotificationMock,
    });

    scheduler.check();
    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].title).toBe("TaskFlow reminder");
    expect(createdNotifications[0].options.body).toMatch(/Review release/);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("starts and stops its interval cleanly", () => {
    const interval = Symbol("interval");
    const setIntervalFn = vi.fn(() => interval);
    const clearIntervalFn = vi.fn();
    const scheduler = createReminderScheduler({
      getTasks: () => [],
      setIntervalFn,
      clearIntervalFn,
    });

    scheduler.start();
    scheduler.start();
    scheduler.stop();
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(clearIntervalFn).toHaveBeenCalledWith(interval);
  });

  it("respects disabled delivery channels", () => {
    const fallback = vi.fn();
    const playSound = vi.fn();
    const scheduler = createReminderScheduler({
      getTasks: () => [dueTask],
      onInAppReminder: fallback,
      onPlaySound: playSound,
      now: () => new Date("2026-08-14T10:00:00.000Z"),
      notificationApi: null,
      getPreferences: () => ({
        enableBrowserNotifications: false,
        enableInAppReminders: false,
        enableSound: true,
      }),
    });

    scheduler.check();
    expect(fallback).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
  });

  it("plays sound when an enabled delivery channel notifies", () => {
    const fallback = vi.fn();
    const playSound = vi.fn();
    const scheduler = createReminderScheduler({
      getTasks: () => [dueTask],
      onInAppReminder: fallback,
      onPlaySound: playSound,
      now: () => new Date("2026-08-14T10:00:00.000Z"),
      notificationApi: null,
      getPreferences: () => ({
        enableBrowserNotifications: false,
        enableInAppReminders: true,
        enableSound: true,
      }),
    });

    scheduler.check();
    expect(fallback).toHaveBeenCalledWith(dueTask);
    expect(playSound).toHaveBeenCalledWith(dueTask);
  });
});
