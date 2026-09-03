import { safeDisplayName } from "../domain/identityDomain";

const labels = {
  task_created: "created a task",
  task_updated: "updated a task",
  task_completed: "completed a task",
  task_status_changed: "changed a task status",
  task_assigned: "assigned a task",
  task_unassigned: "unassigned a task",
  comment_added: "commented on a task",
  comment_updated: "edited a comment",
  comment_deleted: "deleted a comment",
};

const dotModifier = (type) => {
  if (type === "task_completed") return " is-done";
  if (String(type || "").startsWith("comment_")) return " is-comment";
  return "";
};

export default function ActivityRow({ activity }) {
  const actorName = activity.userId ? safeDisplayName(activity) : "TaskFlow";
  const fallbackLabel = String(activity.type || "activity update").replaceAll("_", " ");

  return (
    <article className="activity-row">
      <span className={`activity-dot${dotModifier(activity.type)}`} aria-hidden="true" />
      <div className="activity-main">
        <p className="activity-text">
          <strong>{actorName}</strong> {labels[activity.type] || fallbackLabel}
          {activity.metadata?.taskTitle ? (
            <span className="activity-subject">{activity.metadata.taskTitle}</span>
          ) : null}
        </p>
        <time className="activity-time" dateTime={activity.createdAt || undefined}>
          {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "Just now"}
        </time>
      </div>
    </article>
  );
}
