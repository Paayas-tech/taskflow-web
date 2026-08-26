import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "./application/notificationService";
import { getVisibleUserProfiles } from "./application/projectService";
import {
  filterInboxNotifications,
  notificationLabel,
  notificationTypeLabel,
} from "./domain/notificationDomain";

const formatNotificationTime = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
};

const typeIcon = { task_assigned: "✓", comment_added: "↩", mentioned: "@" };

export default function InboxPage({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const [view, setView] = useState("activity");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getNotifications(userId, 100);
      const profiles = await getVisibleUserProfiles(items.map((item) => item.data?.actorId));
      const names = new Map(profiles.map((profile) => [profile.userId, profile.displayName]));
      setNotifications(items.map((item) => ({
        ...item,
        actorName: names.get(item.data?.actorId) || "",
      })));
      setError("");
    } catch {
      setError("Inbox is temporarily unavailable.");
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
          setLiveNotice("Live updates are paused. Refresh to check for new activity.");
        }
      });
    } catch {
      setLiveNotice("Live updates are paused. Refresh to check for new activity.");
      return undefined;
    }
  }, [load, userId]);

  const visibleNotifications = useMemo(
    () => filterInboxNotifications(notifications, { view, type, sort }),
    [notifications, sort, type, view]
  );
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const mentionedCount = notifications.filter((item) => item.type === "mentioned").length;

  const openNotification = async (notification) => {
    setBusyId(notification.id);
    try {
      if (!notification.readAt) await markNotificationRead(userId, notification.id);
      if (notification.projectId) onNavigate(`/projects/${encodeURIComponent(notification.projectId)}`);
      else await load();
    } catch {
      setError("We couldn't open this notification. Please try again.");
    } finally {
      setBusyId("");
    }
  };

  const markAllRead = async () => {
    setBusyId("all");
    try {
      await markAllNotificationsRead(userId);
      await load();
    } catch {
      setError("We couldn't mark notifications as read. Please try again.");
    } finally {
      setBusyId("");
    }
  };

  const dismiss = async (notification) => {
    setBusyId(notification.id);
    try {
      await deleteNotification(userId, notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch {
      setError("We couldn't dismiss this notification. Please try again.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="inbox-page" aria-label="Inbox activity">
      <div className="inbox-tabs-row">
        <nav className="inbox-tabs" aria-label="Inbox views">
          {[
            ["activity", "Activity", notifications.length],
            ["unread", "Unread", unreadCount],
            ["mentioned", "@Mentioned", mentionedCount],
          ].map(([value, label, count]) => (
            <button key={value} type="button" className={view === value ? "active" : ""} aria-current={view === value ? "page" : undefined} onClick={() => setView(value)}>
              {label}{count > 0 && <span>{count}</span>}
            </button>
          ))}
        </nav>
        <button className="ghost-btn compact-btn" type="button" onClick={() => onNavigate("/settings")}>Manage notifications</button>
      </div>

      <div className="inbox-toolbar">
        <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All activity</option><option value="task_assigned">Assignments</option><option value="comment_added">Comments</option><option value="mentioned">Mentions</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
        <button className="ghost-btn compact-btn" type="button" onClick={() => void markAllRead()} disabled={!unreadCount || busyId === "all"}>{busyId === "all" ? "Updating…" : "Mark all read"}</button>
      </div>

      {liveNotice && <p className="inbox-live-notice" role="status">{liveNotice}</p>}
      {error && <div className="inline-error inbox-error" role="alert"><p>{error}</p><button className="ghost-btn compact-btn" type="button" onClick={() => void load()}>Try again</button></div>}

      {loading ? (
        <div className="inbox-state" role="status"><span className="state-spinner" aria-hidden="true" /><p>Loading activity…</p></div>
      ) : visibleNotifications.length === 0 ? (
        <div className="inbox-state"><span className="inbox-state-icon" aria-hidden="true">✓</span><h2>You're all caught up</h2><p>{view === "mentioned" ? "No mentions need your attention." : view === "unread" ? "You have no unread notifications." : "No activity to show yet."}</p></div>
      ) : (
        <div className="inbox-feed" aria-live="polite">
          {visibleNotifications.map((notification) => (
            <article className={`inbox-item${notification.readAt ? "" : " is-unread"}`} key={notification.id} aria-busy={busyId === notification.id}>
              <span className={`inbox-item-icon inbox-item-${notification.type}`} aria-hidden="true">{typeIcon[notification.type] || "•"}</span>
              <button className="inbox-item-main" type="button" onClick={() => void openNotification(notification)} disabled={busyId === notification.id}>
                <span><strong>{notificationLabel(notification)}</strong>{!notification.readAt && <i aria-label="Unread" />}</span>
                <small><span>{notificationTypeLabel(notification.type)}</span><time dateTime={notification.createdAt || undefined}>{formatNotificationTime(notification.createdAt)}</time></small>
              </button>
              <button className="inbox-item-dismiss" type="button" onClick={() => void dismiss(notification)} disabled={busyId === notification.id} aria-label={`Dismiss: ${notificationLabel(notification)}`}>×</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
