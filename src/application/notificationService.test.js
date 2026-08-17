import { describe, expect, it, vi } from "vitest";
import { createNotificationService } from "./notificationService";

describe("notification application service", () => {
  it("keeps notification access scoped to the authenticated user", async () => {
    const repository = {
      getNotifications: vi.fn().mockResolvedValue([{ id: "notification-a" }]),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      deleteNotification: vi.fn(),
      subscribeToNotifications: vi.fn().mockReturnValue(vi.fn()),
    };
    const service = createNotificationService(repository);

    await expect(service.getNotifications("user-a", 25)).resolves.toEqual([
      { id: "notification-a" },
    ]);
    await service.markNotificationRead("user-a", "notification-a");
    await service.markAllNotificationsRead("user-a");
    await service.deleteNotification("user-a", "notification-a");

    expect(repository.getNotifications).toHaveBeenCalledWith("user-a", 25);
    expect(repository.markNotificationRead).toHaveBeenCalledWith(
      "user-a", "notification-a"
    );
    expect(repository.deleteNotification).toHaveBeenCalledWith(
      "user-a", "notification-a"
    );
  });

  it("returns the repository realtime cleanup callback", () => {
    const unsubscribe = vi.fn();
    const repository = {
      subscribeToNotifications: vi.fn().mockReturnValue(unsubscribe),
    };
    const service = createNotificationService(repository);

    expect(service.subscribeToNotifications("user-a", vi.fn())).toBe(unsubscribe);
  });
});
