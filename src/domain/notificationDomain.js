import { safeDisplayName } from "./identityDomain";

export const notificationLabel = (notification) => {
  const task = notification.data?.taskTitle || "a task";
  const actor = notification.actorName
    ? `${safeDisplayName({ displayName: notification.actorName })} `
    : "";
  if (notification.type === "task_assigned") return `You were assigned ${task}.`;
  if (notification.type === "mentioned") return `${actor}mentioned you on ${task}.`;
  return `${actor}added a comment to ${task}.`;
};

export const notificationTypeLabel = (type) => ({
  task_assigned: "Assignment",
  comment_added: "Comment",
  mentioned: "Mention",
})[type] || "Update";

export const filterInboxNotifications = (
  notifications,
  { view = "activity", type = "all", sort = "newest" } = {}
) => {
  const filtered = notifications.filter((notification) => {
    if (view === "unread" && notification.readAt) return false;
    if (view === "mentioned" && notification.type !== "mentioned") return false;
    return type === "all" || notification.type === type;
  });
  return [...filtered].sort((first, second) => {
    const comparison = String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
    return sort === "oldest" ? -comparison : comparison;
  });
};
