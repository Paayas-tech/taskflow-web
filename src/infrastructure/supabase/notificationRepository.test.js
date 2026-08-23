import { describe, expect, it, vi } from "vitest";
import {
  createNotificationRepository,
  notificationRepository,
} from "./notificationRepository";

const queryResult = (result = { data: null, error: null }) => {
  const calls = [];
  const query = {
    calls,
    select(...args) { calls.push(["select", ...args]); return this; },
    eq(...args) { calls.push(["eq", ...args]); return this; },
    order(...args) { calls.push(["order", ...args]); return this; },
    limit(...args) { calls.push(["limit", ...args]); return this; },
    update(...args) { calls.push(["update", ...args]); return this; },
    is(...args) { calls.push(["is", ...args]); return this; },
    delete(...args) { calls.push(["delete", ...args]); return this; },
    maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
};

const notificationRow = (overrides = {}) => ({
  id: "notification-a",
  user_id: "user-a",
  project_id: "project-a",
  task_id: "task-a",
  type: "task_assigned",
  data: { taskTitle: "Prepare launch" },
  read_at: "2026-08-22T10:00:00.000Z",
  created_at: "2026-08-22T09:00:00.000Z",
  ...overrides,
});

describe("Supabase notification repository", () => {
  it("exports the factory, singleton, and current method signatures", () => {
    expect(createNotificationRepository).toBeTypeOf("function");
    expect(createNotificationRepository).toHaveLength(0);
    expect(notificationRepository).toEqual(expect.objectContaining({
      getNotifications: expect.any(Function),
      markNotificationRead: expect.any(Function),
      markAllNotificationsRead: expect.any(Function),
      deleteNotification: expect.any(Function),
      subscribeToNotifications: expect.any(Function),
    }));
    const repository = createNotificationRepository({});
    expect(repository.getNotifications).toHaveLength(1);
    expect(repository.markNotificationRead).toHaveLength(2);
    expect(repository.markAllNotificationsRead).toHaveLength(1);
    expect(repository.deleteNotification).toHaveLength(2);
    expect(repository.subscribeToNotifications).toHaveLength(2);
  });

  it("reads only the user's notifications, orders them, limits them, and normalizes rows", async () => {
    const query = queryResult({ data: [notificationRow()], error: null });
    const client = { from: vi.fn(() => query) };
    await expect(
      createNotificationRepository(client).getNotifications("user-a", 25)
    ).resolves.toEqual([{
      id: "notification-a",
      userId: "user-a",
      projectId: "project-a",
      taskId: "task-a",
      type: "task_assigned",
      data: { taskTitle: "Prepare launch" },
      readAt: "2026-08-22T10:00:00.000Z",
      createdAt: "2026-08-22T09:00:00.000Z",
    }]);
    expect(client.from).toHaveBeenCalledWith("notifications");
    expect(query.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(query.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(query.calls).toContainEqual(["limit", 25]);
  });

  it("uses the default read limit and preserves current falsey-field normalization", async () => {
    const query = queryResult({
      data: [notificationRow({
        id: undefined, user_id: undefined, project_id: 0, task_id: "",
        type: 17, data: null, read_at: "", created_at: null,
      })],
      error: null,
    });
    const repository = createNotificationRepository({ from: vi.fn(() => query) });
    await expect(repository.getNotifications("user-a")).resolves.toEqual([{
      id: undefined,
      userId: undefined,
      projectId: null,
      taskId: null,
      type: 17,
      data: {},
      readAt: null,
      createdAt: null,
    }]);
    expect(query.calls).toContainEqual(["limit", 50]);
  });

  it("returns an empty read result and propagates read failures", async () => {
    const emptyQuery = queryResult({ data: null, error: null });
    await expect(createNotificationRepository({ from: vi.fn(() => emptyQuery) })
      .getNotifications("user-a")).resolves.toEqual([]);
    const providerError = new Error("notifications unavailable");
    const errorQuery = queryResult({ data: null, error: providerError });
    await expect(createNotificationRepository({ from: vi.fn(() => errorQuery) })
      .getNotifications("user-a")).rejects.toBe(providerError);
  });

  it("marks one owned notification read and normalizes its result", async () => {
    const query = queryResult({ data: notificationRow(), error: null });
    const result = await createNotificationRepository({ from: vi.fn(() => query) })
      .markNotificationRead("user-a", "notification-a");
    expect(result).toEqual(expect.objectContaining({
      id: "notification-a", userId: "user-a", readAt: "2026-08-22T10:00:00.000Z",
    }));
    expect(query.calls).toContainEqual(["eq", "id", "notification-a"]);
    expect(query.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(query.calls).toContainEqual(["maybeSingle"]);
    expect(query.calls.find(([method]) => method === "update")[1].read_at)
      .toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("propagates mark-read failures and rejects a missing owned row", async () => {
    const providerError = new Error("update unavailable");
    const errorQuery = queryResult({ data: null, error: providerError });
    await expect(createNotificationRepository({ from: vi.fn(() => errorQuery) })
      .markNotificationRead("user-a", "notification-a")).rejects.toBe(providerError);
    const missingQuery = queryResult({ data: null, error: null });
    await expect(createNotificationRepository({ from: vi.fn(() => missingQuery) })
      .markNotificationRead("user-a", "notification-a"))
      .rejects.toThrow("This notification is no longer available.");
  });

  it("marks only the user's unread notifications and propagates failures", async () => {
    const query = queryResult({ data: null, error: null });
    await expect(createNotificationRepository({ from: vi.fn(() => query) })
      .markAllNotificationsRead("user-a")).resolves.toBeUndefined();
    expect(query.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(query.calls).toContainEqual(["is", "read_at", null]);
    const providerError = new Error("bulk update unavailable");
    const errorQuery = queryResult({ data: null, error: providerError });
    await expect(createNotificationRepository({ from: vi.fn(() => errorQuery) })
      .markAllNotificationsRead("user-a")).rejects.toBe(providerError);
  });

  it("deletes one owned notification", async () => {
    const query = queryResult({ data: { id: "notification-a" }, error: null });
    await expect(createNotificationRepository({ from: vi.fn(() => query) })
      .deleteNotification("user-a", "notification-a")).resolves.toBeUndefined();
    expect(query.calls).toContainEqual(["delete"]);
    expect(query.calls).toContainEqual(["eq", "id", "notification-a"]);
    expect(query.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(query.calls).toContainEqual(["select", "id"]);
  });

  it("propagates delete failures and rejects a missing owned row", async () => {
    const providerError = new Error("delete unavailable");
    const errorQuery = queryResult({ data: null, error: providerError });
    await expect(createNotificationRepository({ from: vi.fn(() => errorQuery) })
      .deleteNotification("user-a", "notification-a")).rejects.toBe(providerError);
    const missingQuery = queryResult({ data: null, error: null });
    await expect(createNotificationRepository({ from: vi.fn(() => missingQuery) })
      .deleteNotification("user-a", "notification-a"))
      .rejects.toThrow("This notification is no longer available.");
  });

  it("subscribes with the owned filter, forwards payloads, and removes the channel", () => {
    const callback = vi.fn();
    const channel = {
      on: vi.fn(function on() { return this; }),
      subscribe: vi.fn(function subscribe() { return this; }),
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const cleanup = createNotificationRepository(client)
      .subscribeToNotifications("user-a", callback);
    expect(client.channel).toHaveBeenCalledWith("notifications:user-a");
    expect(channel.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "notifications", filter: "user_id=eq.user-a",
    }, callback);
    expect(channel.subscribe).toHaveBeenCalledOnce();
    const payload = { eventType: "INSERT", new: notificationRow() };
    channel.on.mock.calls[0][2](payload);
    expect(callback).toHaveBeenCalledWith(payload);
    cleanup();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("does not transform errors thrown by a realtime callback", () => {
    const callbackError = new Error("consumer callback failed");
    const callback = vi.fn(() => { throw callbackError; });
    const channel = {
      on: vi.fn(function on() { return this; }),
      subscribe: vi.fn(function subscribe() { return this; }),
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    createNotificationRepository(client).subscribeToNotifications("user-a", callback);
    expect(() => channel.on.mock.calls[0][2]({ eventType: "UPDATE" })).toThrow(callbackError);
  });
});
