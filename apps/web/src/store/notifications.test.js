import { describe, expect, it } from "vitest";
import { createFakeApi, makeUser } from "../test/fakeApi";
import {
  dismissNotification,
  loadNotifications,
  markAllRead,
  markRead,
} from "./notifications";
import { startSession } from "./session";
import { configureStore, getState, subscribe } from "./store";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const notification = (id, readAt = null) => ({
  id,
  userId: user.id,
  projectId: "project-1",
  taskId: "task-1",
  type: "task_assigned",
  data: {},
  readAt,
  createdAt: "2026-02-01T08:00:00.000Z",
});

const boot = async () => {
  const api = createFakeApi({
    user,
    notifications: [notification("notification-1"), notification("notification-2")],
  });
  configureStore({ api });
  await startSession(user);
  return api;
};

describe("notifications", () => {
  it("marks one as read immediately and restores it when the write fails", async () => {
    const api = await boot();

    const reading = markRead("notification-1");
    expect(getState().notifications[0].readAt).toBeTruthy();
    expect(await reading).toBe(true);

    api.failNext("markNotificationRead", new Error("offline"));
    expect(await markRead("notification-2")).toBe(false);
    expect(getState().notifications[1].readAt).toBeNull();
    expect(getState().errors.notifications).toBe(
      "We couldn't open this notification. Please try again."
    );
  });

  it("marks everything read", async () => {
    await boot();

    expect(await markAllRead()).toBe(true);
    expect(
      getState().notifications.every((item) => Boolean(item.readAt))
    ).toBe(true);
  });

  it("dismisses one and puts it back when the delete fails", async () => {
    const api = await boot();

    expect(await dismissNotification("notification-1")).toBe(true);
    expect(getState().notifications.map((item) => item.id)).toEqual([
      "notification-2",
    ]);

    api.failNext("deleteNotification", new Error("offline"));
    expect(await dismissNotification("notification-2")).toBe(false);
    expect(getState().notifications).toHaveLength(1);
    expect(getState().errors.notifications).toBe(
      "We couldn't dismiss this notification. Please try again."
    );
  });

  it("reloads without a loading flag once the inbox holds data", async () => {
    const api = await boot();
    api.data.notifications = [notification("notification-3")];

    const statuses = [];
    const unsubscribe = subscribe((state) =>
      statuses.push(state.loaded.notifications)
    );
    await loadNotifications();
    unsubscribe();

    expect(statuses).not.toContain("loading");
    expect(getState().notifications.map((item) => item.id)).toEqual([
      "notification-3",
    ]);
  });
});
