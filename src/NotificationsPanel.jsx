import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "./application/notificationService";
import { getVisibleUserProfiles } from "./application/projectService";
import { notificationLabel } from "./domain/notificationDomain";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";

export default function NotificationsPanel({ userId, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const panelRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextNotifications = await getNotifications(userId);
      const profiles = await getVisibleUserProfiles(
        nextNotifications.map((item) => item.data?.actorId)
      );
      const names = new Map(profiles.map((profile) => [profile.userId, profile.displayName]));
      setNotifications(nextNotifications.map((item) => ({
        ...item,
        actorName: names.get(item.data?.actorId) || "",
      })));
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
      return subscribeToNotifications(userId, () => void load(), (status) => {
        if (status === "SUBSCRIBED") setLiveNotice("");
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setLiveNotice("Live updates are paused. Refresh to check for new notifications.");
        }
      });
    } catch {
      setLiveNotice("Live updates are paused. Refresh to check for new notifications.");
      return undefined;
    }
  }, [load, userId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  useModalLifecycle({
    isOpen: open,
    modalRef: dialogRef,
    onClose: () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
    triggerRef,
    restoreFocus: false,
    lockBodyScroll: false,
  });

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
      <button ref={triggerRef} className="notification-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-haspopup="dialog" aria-controls={dialogId}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section id={dialogId} ref={dialogRef} className="confirmation-dialog notification-dialog" role="dialog" aria-label="Notifications" tabIndex={-1}>
          <div className="section-heading-row notification-dialog-header"><h3>Notifications</h3><div className="notification-dialog-actions"><button className="ghost-btn compact-btn notification-read-all" type="button" onClick={() => void markAllRead()} disabled={!unreadCount}>Mark all read</button><button className="notification-dialog-close" type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close notifications">×</button></div></div>
          {liveNotice && <p className="form-hint" role="status">{liveNotice}</p>}
          {loading ? <p className="notification-empty-state" role="status">Loading…</p> : error ? <div><p className="form-error" role="alert">{error}</p><button className="ghost-btn compact-btn" type="button" onClick={() => void load()}>Retry</button></div> : notifications.length === 0 ? <p className="notification-empty-state">No notifications</p> : (
            <div className="settings-list">
              {notifications.map((notification) => (
                <article className="notification-row" key={notification.id}>
                  <button className="task-title-button" type="button" onClick={() => void openNotification(notification)}><strong>{notificationLabel(notification)}</strong></button>
                  <p className="form-hint">{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : "Just now"}</p>
                  <button className="ghost-btn compact-btn" type="button" onClick={() => void dismissNotification(notification.id)} aria-label={`Dismiss notification: ${notificationLabel(notification)}`}>Dismiss</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
