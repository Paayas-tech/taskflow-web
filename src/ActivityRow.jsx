import { safeDisplayName } from "./domain/identityDomain";

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

const activityIcons = {
  task_created: "+",
  task_updated: "✎",
  task_completed: "✓",
  task_status_changed: "↔",
  task_assigned: "@",
  task_unassigned: "−",
  comment_added: "↩",
  comment_updated: "✎",
  comment_deleted: "×",
};

export default function ActivityRow({ activity }) {
  const actorName = activity.userId ? safeDisplayName(activity) : "TaskFlow";
  const fallbackLabel = String(activity.type || "activity update").replaceAll("_", " ");
  return (
    <article className="task-history-row">
      <span className={`task-history-icon task-history-icon-${activity.type || "default"}`} aria-hidden="true">{activityIcons[activity.type] || "•"}</span>
      <div className="task-history-content"><p><strong>{actorName}</strong> {labels[activity.type] || fallbackLabel}{activity.metadata?.taskTitle ? <span className="task-history-subject">{activity.metadata.taskTitle}</span> : null}</p><time dateTime={activity.createdAt || undefined}>{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "Just now"}</time></div>
    </article>
  );
}
