import {
  currentUserId,
  requireSupabase,
  subscribeToTable,
  throwIfError,
} from "./client";
import { withAuthors } from "./projects";

const COMMENT_SELECT = "id, task_id, user_id, content, edited_at, created_at";
const ACTIVITY_SELECT =
  "id, project_id, task_id, user_id, event_type, metadata, created_at";
const NOTIFICATION_SELECT =
  "id, user_id, project_id, task_id, type, data, read_at, created_at";

const commentRows = () => requireSupabase().from("task_comments");
const notificationRows = () => requireSupabase().from("notifications");

const rowToComment = (row = {}) => ({
  id: row.id,
  taskId: row.task_id,
  userId: row.user_id,
  content: row.content || "",
  editedAt: row.edited_at || null,
  createdAt: row.created_at || null,
});

const rowToActivity = (row = {}) => ({
  id: row.id,
  projectId: row.project_id || null,
  taskId: row.task_id || null,
  userId: row.user_id || null,
  type: row.event_type,
  metadata: row.metadata || {},
  createdAt: row.created_at || null,
});

const rowToNotification = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id || null,
  taskId: row.task_id || null,
  type: row.type,
  data: row.data || {},
  readAt: row.read_at || null,
  createdAt: row.created_at || null,
});

/** A realtime subscription over the rows of `table` that carry one id. */
const subscription =
  (prefix, table, column) =>
  (id, onChange, onStatus) =>
    subscribeToTable({
      channel: `${prefix}:${id}`,
      table,
      filter: `${column}=eq.${id}`,
      onChange,
      onStatus,
    });

export const listComments = async (taskId) => {
  const { data, error } = await commentRows()
    .select(COMMENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return withAuthors((data || []).map(rowToComment));
};

export const createComment = async (taskId, content) => {
  // The insert policy checks user_id = auth.uid(), so the author is stamped here.
  const userId = await currentUserId();
  const { data, error } = await commentRows()
    .insert({ task_id: taskId, user_id: userId, content })
    .select(COMMENT_SELECT)
    .single();
  throwIfError(error);
  return rowToComment(data);
};

export const updateComment = async (id, content) => {
  const { data, error } = await commentRows()
    .update({ content })
    .eq("id", id)
    .select(COMMENT_SELECT)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This comment is no longer available.");
  return rowToComment(data);
};

export const deleteComment = async (id) => {
  const { data, error } = await commentRows()
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This comment is no longer available.");
};

const listActivity = async (column, value, limit) => {
  const { data, error } = await requireSupabase()
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return withAuthors((data || []).map(rowToActivity));
};

export const listProjectActivity = (projectId, limit = 50) =>
  listActivity("project_id", projectId, limit);

export const listTaskActivity = (taskId, limit = 30) =>
  listActivity("task_id", taskId, limit);

export const subscribeToComments =
  subscription("task-comments", "task_comments", "task_id");

export const subscribeToProjectActivity =
  subscription("project-activity", "activity_events", "project_id");

export const subscribeToTaskActivity =
  subscription("task-activity", "activity_events", "task_id");

export const listNotifications = async (limit = 100) => {
  const { data, error } = await notificationRows()
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data || []).map(rowToNotification);
};

export const markNotificationRead = async (id) => {
  const { data, error } = await notificationRows()
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This notification is no longer available.");
  return rowToNotification(data);
};

export const markAllNotificationsRead = async () => {
  const { error } = await notificationRows()
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  throwIfError(error);
};

export const deleteNotification = async (id) => {
  const { data, error } = await notificationRows()
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This notification is no longer available.");
};

export const subscribeToNotifications =
  subscription("notifications", "notifications", "user_id");
