import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "./application/notificationService";

const notificationLabel = (notification) => {
  const task = notification.data?.taskTitle || "a task";
  if (notification.type === "task_assigned") return `You were assigned ${task}.`;
  if (notification.type === "mentioned") return `You were mentioned on ${task}.`;
  return `A comment was added to ${task}.`;
};

export default function NotificationsPanel({ userId, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await getNotifications(userId));
      setError("");
    } catch {
      setError("Notifications are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    try {
      return subscribeToNotifications(userId, () => void load());
    } catch {
      setError("Notifications require the Supabase collaboration backend.");
      return undefined;
    }
  }, [load, userId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const openNotification = async (notification) => {
    try {
      if (!notification.readAt) {
        await markNotificationRead(userId, notification.id);
      }
      setOpen(false);
      if (notification.projectId) {
        onNavigate(`/projects/${notification.projectId}`);
      }
      await load();
    } catch {
      setError("We couldn't open this notification. Please try again.");
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead(userId);
      await load();
    } catch {
      setError("We couldn't mark notifications as read. Please try again.");
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await deleteNotification(userId, notificationId);
      await load();
    } catch {
      setError("We couldn't dismiss this notification. Please try again.");
    }
  };

  return (
    <div ref={panelRef} className="notification-center">
      <button ref={triggerRef} className="ghost-btn compact-btn" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog">
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>
      {open && (
        <section ref={dialogRef} className="confirmation-dialog" role="dialog" aria-label="Notifications" tabIndex={-1}>
          <div className="section-heading-row"><h3>Notifications</h3><button className="ghost-btn compact-btn" type="button" onClick={() => void markAllRead()} disabled={!unreadCount}>Mark all read</button></div>
          {loading ? <p role="status">Loading notifications...</p> : error ? <div><p className="form-error" role="alert">{error}</p><button className="ghost-btn compact-btn" type="button" onClick={() => void load()}>Try again</button></div> : notifications.length === 0 ? <p className="form-hint">You're all caught up.</p> : (
            <div className="settings-list">
              {notifications.map((notification) => (
                <article className="settings-card" key={notification.id}>
                  <button className="task-title-button" type="button" onClick={() => void openNotification(notification)}><strong>{notificationLabel(notification)}</strong></button>
                  <p className="form-hint">{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : "Just now"}</p>
                  <button className="ghost-btn compact-btn" type="button" onClick={() => void dismissNotification(notification.id)}>Dismiss</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
