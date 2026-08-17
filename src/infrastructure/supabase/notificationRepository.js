import { requireSupabase } from "./client.js";

const throwIfError = (error) => {
  if (error) throw error;
};

const normalizeNotification = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id || null,
  taskId: row.task_id || null,
  type: row.type,
  data: row.data || {},
  readAt: row.read_at || null,
  createdAt: row.created_at || null,
});

export const createNotificationRepository = (client = null) => {
  const database = () => client || requireSupabase();

  return {
    async getNotifications(userId, limit = 50) {
      const { data, error } = await database()
        .from("notifications")
        .select("id, user_id, project_id, task_id, type, data, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      throwIfError(error);
      return (data || []).map(normalizeNotification);
    },

    async markNotificationRead(userId, notificationId) {
      const { data, error } = await database()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .select("id, user_id, project_id, task_id, type, data, read_at, created_at")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This notification is no longer available.");
      return normalizeNotification(data);
    },

    async markAllNotificationsRead(userId) {
      const { error } = await database()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      throwIfError(error);
    },

    async deleteNotification(userId, notificationId) {
      const { data, error } = await database()
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This notification is no longer available.");
    },

    subscribeToNotifications(userId, onChange) {
      const db = database();
      const channel = db
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          onChange
        )
        .subscribe();
      return () => void db.removeChannel(channel);
    },
  };
};

export const notificationRepository = createNotificationRepository();
