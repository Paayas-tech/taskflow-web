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

export default function ActivityRow({ activity }) {
  const actorName = activity.userId ? safeDisplayName(activity) : "TaskFlow";
  return (
    <article className="settings-card task-history-row">
      <span className="task-collaboration-avatar" aria-hidden="true">{actorName.slice(0, 1).toUpperCase()}</span>
      <div><p><strong>{actorName}</strong> {labels[activity.type] || activity.type.replaceAll("_", " ")}{activity.metadata?.taskTitle ? ` · ${activity.metadata.taskTitle}` : ""}</p><time className="form-hint" dateTime={activity.createdAt || undefined}>{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "Just now"}</time></div>
    </article>
  );
}
