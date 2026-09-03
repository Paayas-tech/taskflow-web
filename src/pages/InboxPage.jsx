import { useMemo, useState } from "react";
import { Button, EmptyState, Icon, IconButton, InlineNotice, Tabs } from "../ui";
import { cx } from "../ui/cx";
import { projectPath } from "../app/appRoutes";
import {
  filterInboxNotifications,
  notificationLabel,
  notificationTypeLabel,
} from "../domain/notificationDomain";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatNotificationTime = (value) => {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Just now" : timeFormat.format(date);
};

const typeIcons = {
  task_assigned: { modifier: "is-assignment", icon: "user" },
  comment_added: { modifier: "is-comment", icon: "message-circle" },
  mentioned: { modifier: "is-mention", icon: null },
};

const emptyDescriptions = {
  activity: "Assignments, comments and mentions land here.",
  unread: "Every notification has been read.",
  mentioned: "No one has mentioned you yet.",
};

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.stopPropagation();
  }
};

/** Notification feed: all activity, unread only, or mentions of you. */
export function InboxPage({
  notifications = [],
  loading = false,
  error = "",
  liveNotice = "",
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onRefresh,
  onNavigate,
  onOpenSettings,
}) {
  const [view, setView] = useState("activity");
  const [pendingId, setPendingId] = useState("");
  const [markAllPending, setMarkAllPending] = useState(false);

  const visibleNotifications = useMemo(
    () => filterInboxNotifications(notifications, { view }),
    [notifications, view]
  );
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const mentionCount = notifications.filter((item) => item.type === "mentioned").length;

  const openNotification = async (notification) => {
    if (pendingId) return;
    setPendingId(notification.id);
    try {
      if (!notification.readAt) await onMarkRead?.(notification.id);
      if (notification.projectId) onNavigate?.(projectPath(notification.projectId));
    } finally {
      setPendingId("");
    }
  };

  const dismissNotification = async (notification) => {
    setPendingId(notification.id);
    try {
      await onDismiss?.(notification.id);
    } finally {
      setPendingId("");
    }
  };

  const markAllRead = async () => {
    setMarkAllPending(true);
    try {
      await onMarkAllRead?.();
    } finally {
      setMarkAllPending(false);
    }
  };

  return (
    <section className="page inbox-page" aria-label="Inbox">
      <header className="page-header">
        <h1 className="page-title">Inbox</h1>
        <Tabs
          className="inbox-tabs"
          ariaLabel="Inbox filters"
          value={view}
          onChange={setView}
          items={[
            { id: "activity", label: "All", count: notifications.length },
            { id: "unread", label: "Unread", count: unreadCount },
            { id: "mentioned", label: "Mentions", count: mentionCount },
          ]}
        />
        <div className="page-actions">
          <Button
            disabled={unreadCount === 0}
            loading={markAllPending}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
          <Button variant="ghost" icon={<Icon name="settings" />} onClick={() => onOpenSettings?.()}>
            Notification settings
          </Button>
        </div>
      </header>

      <div className="page-body is-narrow">
        {liveNotice ? (
          <InlineNotice tone="info" className="page-notice">
            {liveNotice}
          </InlineNotice>
        ) : null}

        {error ? (
          <InlineNotice
            tone="error"
            className="page-notice"
            action={
              <Button size="sm" onClick={() => onRefresh?.()}>
                Retry
              </Button>
            }
          >
            {error}
          </InlineNotice>
        ) : null}

        {loading ? (
          <div className="row-list" role="status" aria-label="Loading notifications">
            {[0, 1, 2].map((row) => (
              <div className="skeleton-row" key={row}>
                <span className="skeleton inbox-skeleton" />
              </div>
            ))}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="You're all caught up"
            description={emptyDescriptions[view]}
          />
        ) : (
          <div className="row-list" aria-live="polite">
            {visibleNotifications.map((notification) => {
              const label = notificationLabel(notification);
              const unread = !notification.readAt;
              const busy = pendingId === notification.id;
              const type = typeIcons[notification.type] || typeIcons.comment_added;

              return (
                <div
                  key={notification.id}
                  className={cx("inbox-item", unread && "is-unread")}
                  role="button"
                  tabIndex={0}
                  aria-busy={busy || undefined}
                  onClick={() => void openNotification(notification)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    void openNotification(notification);
                  }}
                >
                  <span className={cx("inbox-item-icon", type.modifier)} aria-hidden="true">
                    {type.icon ? <Icon name={type.icon} size={14} /> : "@"}
                  </span>

                  <div className="inbox-item-main">
                    <span className="inbox-item-label">{label}</span>
                    <span className="inbox-item-meta">
                      {notificationTypeLabel(notification.type)}
                      {" · "}
                      <time dateTime={notification.createdAt || undefined}>
                        {formatNotificationTime(notification.createdAt)}
                      </time>
                    </span>
                  </div>

                  {unread ? <span className="inbox-item-dot" role="img" aria-label="Unread" /> : null}

                  <span className="inbox-item-actions" onClick={stopPointer} onKeyDown={stopKeys}>
                    <IconButton
                      label={`Dismiss: ${label}`}
                      size="sm"
                      disabled={busy}
                      onClick={() => void dismissNotification(notification)}
                    >
                      <Icon name="x" />
                    </IconButton>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default InboxPage;
