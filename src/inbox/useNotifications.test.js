import { beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  const same = (left, right) =>
    Boolean(
      left &&
        right &&
        left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]))
    );

  return {
    activate(runner) {
      activeRunner = runner;
    },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        },
      ];
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.callback;
      }
      activeRunner.slots[index] = { callback, dependencies };
      return callback;
    },
    useMemo(factory, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.value;
      }
      const value = factory();
      activeRunner.slots[index] = { value, dependencies };
      return value;
    },
    useEffect(effect, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (!previous || !same(previous.dependencies, dependencies)) {
        activeRunner.pending.push({ index, effect, dependencies });
      }
    },
  };
});

const notificationService = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

const projectService = vi.hoisted(() => ({ getVisibleUserProfiles: vi.fn() }));

vi.mock("react", () => ({
  default: {},
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("../application/notificationService", () => notificationService);
vi.mock("../application/projectService", () => projectService);

import { useNotifications } from "./useNotifications";

const notification = (overrides = {}) => ({
  id: "notification-a",
  type: "task_assigned",
  readAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  projectId: "project-a",
  data: { actorId: "member-a", taskTitle: "Ship the release" },
  ...overrides,
});

function createRunner(userId) {
  const runner = { cursor: 0, pending: [], slots: [], value: null };

  function NotificationsProbe() {
    runner.value = useNotifications(userId);
    return null;
  }

  const render = () => {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    NotificationsProbe();
    for (const pending of runner.pending) {
      runner.slots[pending.index]?.cleanup?.();
      runner.slots[pending.index] = {
        dependencies: pending.dependencies,
        cleanup: pending.effect(),
      };
    }
    return runner.value;
  };

  render();
  return {
    render,
    unmount() {
      for (const slot of [...runner.slots].reverse()) slot?.cleanup?.();
    },
    get value() {
      return runner.value;
    },
  };
}

const flush = async (runner) => {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  return runner.render();
};

beforeEach(() => {
  notificationService.getNotifications
    .mockReset()
    .mockResolvedValue([notification(), notification({ id: "notification-b", readAt: "2026-09-01T10:00:00.000Z" })]);
  notificationService.markNotificationRead.mockReset().mockResolvedValue(undefined);
  notificationService.markAllNotificationsRead.mockReset().mockResolvedValue(undefined);
  notificationService.deleteNotification.mockReset().mockResolvedValue(undefined);
  notificationService.subscribeToNotifications.mockReset().mockReturnValue(vi.fn());
  projectService.getVisibleUserProfiles
    .mockReset()
    .mockResolvedValue([{ userId: "member-a", displayName: "Priya Shah" }]);
});

describe("useNotifications", () => {
  it("loads notifications with actor names and counts the unread ones", async () => {
    const runner = createRunner("user-a");
    expect(runner.value.loading).toBe(true);

    await flush(runner);

    expect(notificationService.getNotifications).toHaveBeenCalledWith("user-a", 100);
    expect(runner.value.notifications.map((item) => item.actorName)).toEqual([
      "Priya Shah",
      "Priya Shah",
    ]);
    expect(runner.value.unreadCount).toBe(1);
    expect(runner.value.loading).toBe(false);
    expect(runner.value.error).toBe("");
  });

  it("subscribes once and reloads when the channel reports a change", async () => {
    const runner = createRunner("user-a");
    await flush(runner);

    expect(notificationService.subscribeToNotifications).toHaveBeenCalledOnce();
    const [, onChange] = notificationService.subscribeToNotifications.mock.calls[0];

    onChange();
    await flush(runner);

    expect(notificationService.getNotifications).toHaveBeenCalledTimes(2);
  });

  it("warns when live updates stop and clears the warning when they resume", async () => {
    const runner = createRunner("user-a");
    await flush(runner);
    const [, , onStatus] = notificationService.subscribeToNotifications.mock.calls[0];

    onStatus("CHANNEL_ERROR");
    runner.render();
    expect(runner.value.liveNotice).toBe(
      "Live updates are paused. Refresh to check for new activity."
    );

    onStatus("SUBSCRIBED");
    runner.render();
    expect(runner.value.liveNotice).toBe("");
  });

  it("keeps working when the channel cannot be opened", async () => {
    notificationService.subscribeToNotifications.mockImplementation(() => {
      throw new Error("offline");
    });
    const runner = createRunner("user-a");
    await flush(runner);

    expect(runner.value.liveNotice).toBe(
      "Live updates are paused. Refresh to check for new activity."
    );
    expect(runner.value.notifications).toHaveLength(2);
  });

  it("marks one notification read without reloading everything", async () => {
    const runner = createRunner("user-a");
    await flush(runner);

    await runner.value.markRead("notification-a");
    runner.render();

    expect(notificationService.markNotificationRead).toHaveBeenCalledWith(
      "user-a",
      "notification-a"
    );
    expect(notificationService.getNotifications).toHaveBeenCalledOnce();
    expect(runner.value.unreadCount).toBe(0);
  });

  it("reloads after marking everything read", async () => {
    const runner = createRunner("user-a");
    await flush(runner);
    notificationService.getNotifications.mockResolvedValue([
      notification({ readAt: "2026-09-01T11:00:00.000Z" }),
    ]);

    await runner.value.markAllRead();
    await flush(runner);

    expect(notificationService.markAllNotificationsRead).toHaveBeenCalledWith("user-a");
    expect(runner.value.unreadCount).toBe(0);
  });

  it("drops a dismissed notification from the list", async () => {
    const runner = createRunner("user-a");
    await flush(runner);

    await runner.value.dismiss("notification-a");
    runner.render();

    expect(notificationService.deleteNotification).toHaveBeenCalledWith(
      "user-a",
      "notification-a"
    );
    expect(runner.value.notifications.map((item) => item.id)).toEqual([
      "notification-b",
    ]);
  });

  it("reports a load failure and recovers on refresh", async () => {
    notificationService.getNotifications.mockRejectedValueOnce(new Error("offline"));
    const runner = createRunner("user-a");
    await flush(runner);

    expect(runner.value.error).toBe("Inbox is temporarily unavailable.");

    runner.value.refresh();
    await flush(runner);

    expect(runner.value.error).toBe("");
    expect(runner.value.notifications).toHaveLength(2);
  });

  it("stays idle without a signed-in user", async () => {
    const runner = createRunner("");
    await flush(runner);

    expect(notificationService.getNotifications).not.toHaveBeenCalled();
    expect(notificationService.subscribeToNotifications).not.toHaveBeenCalled();
    expect(runner.value).toEqual(
      expect.objectContaining({ notifications: [], loading: false, unreadCount: 0 })
    );
  });
});
