/**
 * Notification actions. The list loads once per session and is kept fresh by
 * the realtime subscription `session.js` opens; every mutation is optimistic.
 */
import { api, getState, isCurrentSession, sessionStamp, setState } from "./store";

const LOAD_ERROR = "Inbox is temporarily unavailable.";
const READ_ERROR = "We couldn't open this notification. Please try again.";
const READ_ALL_ERROR = "We couldn't mark notifications as read. Please try again.";
const DISMISS_ERROR = "We couldn't dismiss this notification. Please try again.";

const setStatus = (status, error = "") =>
  setState((state) => ({
    loaded: { ...state.loaded, notifications: status },
    errors: { ...state.errors, notifications: error },
  }));

const setNotifications = (notifications) => setState({ notifications });

/**
 * Loads the inbox. Silent while the store already holds notifications, so a
 * realtime refresh never flashes a skeleton.
 */
export const loadNotifications = async ({ silent } = {}) => {
  const session = sessionStamp();
  const stateAtStart = getState();
  if (!stateAtStart.auth.user) return null;
  const notificationsAtStart = stateAtStart.notifications;
  const quiet = silent ?? notificationsAtStart.length > 0;
  if (!quiet) setStatus("loading");

  try {
    const notifications = await api().listNotifications();
    // Signed out while this was on the wire: the inbox belongs to nobody now.
    if (!isCurrentSession(session)) return null;
    setState((state) => {
      const before = new Map(notificationsAtStart.map((item) => [item.id, item]));
      const current = new Map(state.notifications.map((item) => [item.id, item]));
      const incoming = new Map(notifications.map((item) => [item.id, item]));

      // A mark-read or dismiss action that happened after this load started is
      // newer than its response. Keep those changed/removal entries.
      new Set([...before.keys(), ...current.keys()]).forEach((id) => {
        if (before.get(id) === current.get(id)) return;
        if (current.has(id)) incoming.set(id, current.get(id));
        else incoming.delete(id);
      });
      return { notifications: [...incoming.values()] };
    });
    setStatus("ready");
    return notifications;
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!quiet) setStatus("error", LOAD_ERROR);
    return null;
  }
};

export const markRead = async (notificationId) => {
  const session = sessionStamp();
  const previous = getState().notifications;
  const readAt = new Date().toISOString();
  setNotifications(
    previous.map((notification) =>
      notification.id === notificationId
        ? { ...notification, readAt: notification.readAt || readAt }
        : notification
    )
  );

  try {
    await api().markNotificationRead(notificationId);
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    setNotifications(previous);
    setStatus(getState().loaded.notifications, READ_ERROR);
    return false;
  }
};

export const markAllRead = async () => {
  const session = sessionStamp();
  const previous = getState().notifications;
  const readAt = new Date().toISOString();
  setNotifications(
    previous.map((notification) =>
      notification.readAt ? notification : { ...notification, readAt }
    )
  );

  try {
    await api().markAllNotificationsRead();
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    setNotifications(previous);
    setStatus(getState().loaded.notifications, READ_ALL_ERROR);
    return false;
  }
};

export const dismissNotification = async (notificationId) => {
  const session = sessionStamp();
  const previous = getState().notifications;
  setNotifications(
    previous.filter((notification) => notification.id !== notificationId)
  );

  try {
    await api().deleteNotification(notificationId);
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    setNotifications(previous);
    setStatus(getState().loaded.notifications, DISMISS_ERROR);
    return false;
  }
};
