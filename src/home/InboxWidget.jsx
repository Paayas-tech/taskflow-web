import { useMemo } from "react";
import { projectPath } from "../app/appRoutes";
import { notificationLabel, notificationTypeLabel } from "../domain/notificationDomain";
import { Button } from "../ui";
import { cx } from "../ui/cx";
import { latestNotifications } from "./homeData";
import { Widget, WidgetSkeleton } from "./Widget";

const VISIBLE_LIMIT = 5;

const formatNotificationTime = (value, formatSettings) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: formatSettings?.format !== "24-hour",
  }).format(date);
};

/** The five newest notifications, unread first-class, linking into the project. */
export function InboxWidget({
  notifications = [],
  loading = false,
  onNavigate,
  formatSettings,
}) {
  const visible = useMemo(
    () => latestNotifications(notifications, VISIBLE_LIMIT),
    [notifications]
  );

  return (
    <Widget
      className="inbox-widget"
      title="Inbox"
      actions={
        <Button variant="ghost" size="sm" onClick={() => onNavigate?.("/inbox")}>
          Open inbox
        </Button>
      }
    >
      {loading ? <WidgetSkeleton label="Loading notifications" rows={2} /> : null}
      {!loading && visible.length === 0 ? (
        <p className="widget-empty muted">You're all caught up.</p>
      ) : null}
      {!loading
        ? visible.map((notification) => {
            const unread = !notification.readAt;
            return (
              <button
                key={notification.id}
                type="button"
                className={cx("widget-row", "inbox-row", unread && "is-unread")}
                onClick={() =>
                  onNavigate?.(
                    notification.projectId
                      ? projectPath(notification.projectId)
                      : "/inbox"
                  )
                }
              >
                <span className="inbox-row-dot" aria-hidden="true" />
                <span className="inbox-row-main">
                  <span className="inbox-row-text truncate">
                    {notificationLabel(notification)}
                  </span>
                  <span className="inbox-row-meta muted">
                    {notificationTypeLabel(notification.type)} ·{" "}
                    {formatNotificationTime(notification.createdAt, formatSettings)}
                  </span>
                </span>
                {unread ? <span className="sr-only">Unread</span> : null}
              </button>
            );
          })
        : null}
    </Widget>
  );
}

export default InboxWidget;
