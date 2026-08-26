import { describe, expect, it } from "vitest";
import { filterInboxNotifications, notificationLabel } from "./notificationDomain";

const notifications = [
  { id: "read", type: "comment_added", readAt: "2026-08-26T10:00:00Z", createdAt: "2026-08-26T10:00:00Z", data: { taskTitle: "Plan" }, actorName: "Riya" },
  { id: "mention", type: "mentioned", readAt: null, createdAt: "2026-08-26T12:00:00Z", data: { taskTitle: "Review" }, actorName: "Dev" },
  { id: "assigned", type: "task_assigned", readAt: null, createdAt: "2026-08-26T11:00:00Z", data: { taskTitle: "Ship" } },
];

describe("notification inbox presentation", () => {
  it("creates human-readable labels without exposing identifiers", () => {
    expect(notificationLabel(notifications[1])).toBe("Dev mentioned you on Review.");
    expect(notificationLabel(notifications[2])).toBe("You were assigned Ship.");
  });

  it("filters unread and mentioned activity and sorts both directions", () => {
    expect(filterInboxNotifications(notifications, { view: "unread" }).map(({ id }) => id)).toEqual(["mention", "assigned"]);
    expect(filterInboxNotifications(notifications, { view: "mentioned" }).map(({ id }) => id)).toEqual(["mention"]);
    expect(filterInboxNotifications(notifications, { sort: "oldest" }).map(({ id }) => id)).toEqual(["read", "assigned", "mention"]);
  });
});
