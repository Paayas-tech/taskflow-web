import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeApi, makeTask, makeUser } from "../test/fakeApi";
import {
  createReminderScheduler,
  startReminderScheduler,
  stopReminderScheduler,
} from "./reminders";
import { startSession } from "./session";
import { configureStore, getState, setState } from "./store";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const dueTask = (overrides = {}) =>
  makeTask({
    id: "task-1",
    title: "Call the printer",
    dueDate: "2026-03-04",
    startTime: "09:00",
    reminder: true,
    reminderAt: "2026-03-04T08:45:00.000Z",
    ...overrides,
  });

const boot = async (tasks = [dueTask()]) => {
  const api = createFakeApi({ user, tasks });
  configureStore({ api });
  await startSession(user);
  return api;
};

const at = (iso) => () => new Date(iso);

afterEach(() => {
  stopReminderScheduler();
});

describe("createReminderScheduler", () => {
  it("announces a due reminder in the app exactly once", async () => {
    await boot();
    const scheduler = createReminderScheduler({ now: at("2026-03-04T08:46:00.000Z") });

    expect(scheduler.check()).toHaveLength(1);
    expect(getState().ui.reminderNotice.title).toBe("Call the printer");

    setState({ ui: { ...getState().ui, reminderNotice: null } });
    expect(scheduler.check()).toHaveLength(0);
    expect(getState().ui.reminderNotice).toBeNull();
  });

  it("prefers a browser notification, and opens the task when it is clicked", async () => {
    await boot();
    const notifications = [];
    class FakeNotification {
      static permission = "granted";
      constructor(title, options) {
        this.title = title;
        this.options = options;
        this.close = vi.fn();
        notifications.push(this);
      }
    }

    const scheduler = createReminderScheduler({
      now: at("2026-03-04T08:46:00.000Z"),
      notificationApi: FakeNotification,
    });
    scheduler.check();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].options.body).toBe(
      "Call the printer. Scheduled for 2026-03-04 at 09:00."
    );
    // The browser told the person; the in-app toast stays quiet.
    expect(getState().ui.reminderNotice).toBeNull();

    notifications[0].onclick();
    expect(getState().ui.selectedTaskId).toBe("task-1");
  });

  it("plays the sound only when the setting is on", async () => {
    await boot();
    const onPlaySound = vi.fn();
    const scheduler = createReminderScheduler({
      now: at("2026-03-04T08:46:00.000Z"),
      onPlaySound,
      getPreferences: () => ({ enableSound: false }),
    });
    scheduler.check();
    expect(onPlaySound).not.toHaveBeenCalled();

    const loud = createReminderScheduler({
      now: at("2026-03-04T08:46:00.000Z"),
      onPlaySound,
      getPreferences: () => ({ enableSound: true }),
    });
    loud.check();
    expect(onPlaySound).toHaveBeenCalledTimes(1);
  });

  it("ignores reminders on completed and archived work", async () => {
    await boot([
      dueTask({ id: "task-done", status: "completed", completed: true }),
      dueTask({ id: "task-archived", archivedAt: "2026-03-01T10:00:00.000Z" }),
    ]);
    const scheduler = createReminderScheduler({ now: at("2026-03-04T08:46:00.000Z") });

    expect(scheduler.check()).toHaveLength(0);
  });
});

describe("startReminderScheduler", () => {
  it("re-checks as soon as the tasks in the store change", async () => {
    await boot([makeTask({ id: "task-1", title: "Call the printer" })]);
    const now = at("2026-03-04T08:46:00.000Z");
    startReminderScheduler({ now, setIntervalFn: () => 1, clearIntervalFn: () => {} });
    expect(getState().ui.reminderNotice).toBeNull();

    setState((state) => ({
      tasks: {
        ...state.tasks,
        "task-1": {
          ...state.tasks["task-1"],
          reminder: true,
          reminderAt: "2026-03-04T08:45:00.000Z",
        },
      },
    }));

    expect(getState().ui.reminderNotice.id).toBe("task-1");

    stopReminderScheduler();
    expect(getState().ui.reminderNotice).toBeNull();
  });
});
