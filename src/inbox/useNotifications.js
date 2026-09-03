import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../application/notificationService";
import { getVisibleUserProfiles } from "../application/projectService";

const LIVE_PAUSED_NOTICE =
  "Live updates are paused. Refresh to check for new activity.";
const BROKEN_CHANNEL_STATUSES = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"];
const NOTIFICATION_LIMIT = 100;

/**
 * Loads the signed-in person's notifications once, keeps them live, and exposes
 * the mutations the Inbox page, Home widget and sidebar badge need.
 */
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const items = await getNotifications(userId, NOTIFICATION_LIMIT);
      const profiles = await getVisibleUserProfiles(
        items.map((item) => item.data?.actorId)
      );
      const names = new Map(
        profiles.map((profile) => [profile.userId, profile.displayName])
      );
      setNotifications(
        items.map((item) => ({
          ...item,
          actorName: names.get(item.data?.actorId) || "",
        }))
      );
      setError("");
    } catch {
      setError("Inbox is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    void load();
    try {
      return subscribeToNotifications(
        userId,
        () => void load(),
        (status) => {
          if (status === "SUBSCRIBED") setLiveNotice("");
          else if (BROKEN_CHANNEL_STATUSES.includes(status)) {
            setLiveNotice(LIVE_PAUSED_NOTICE);
          }
        }
      );
    } catch {
      setLiveNotice(LIVE_PAUSED_NOTICE);
      return undefined;
    }
  }, [load, userId]);

  const markRead = useCallback(
    async (notificationId) => {
      if (!userId) return;
      try {
        await markNotificationRead(userId, notificationId);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId
              ? { ...item, readAt: item.readAt || new Date().toISOString() }
              : item
          )
        );
      } catch {
        setError("We couldn't open this notification. Please try again.");
      }
    },
    [userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      await load();
    } catch {
      setError("We couldn't mark notifications as read. Please try again.");
    }
  }, [load, userId]);

  const dismiss = useCallback(
    async (notificationId) => {
      if (!userId) return;
      try {
        await deleteNotification(userId, notificationId);
        setNotifications((current) =>
          current.filter((item) => item.id !== notificationId)
        );
      } catch {
        setError("We couldn't dismiss this notification. Please try again.");
      }
    },
    [userId]
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  return {
    notifications,
    loading,
    error,
    liveNotice,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    refresh,
  };
}

export default useNotifications;
