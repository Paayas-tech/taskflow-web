import { isTaskComplete } from "./domain/taskDomain";
import { safeDisplayName } from "./domain/identityDomain";

const defaultStatuses = [
  { key: "todo", label: "To do" },
  { key: "in-progress", label: "In progress" },
  { key: "completed", label: "Done" },
];

const statusKey = (task) => {
  if (isTaskComplete(task)) return "completed";
  if (["in-progress", "in_progress"].includes(task.status)) return "in-progress";
  return "todo";
};

export default function StoryOverviewPanel({ tasks = [], columns = [], members = [] }) {
  const total = tasks.length;
  const completed = tasks.filter(isTaskComplete).length;
  const remaining = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const statusCounts = new Map(
    (columns.length > 0 ? columns : defaultStatuses).map((item) => [
      item.id || item.key,
      { label: item.name || item.title || item.label, count: 0 },
    ])
  );

  for (const task of tasks) {
    const column = columnsById.get(task.columnId);
    const key = column?.id || statusKey(task);
    const fallback = defaultStatuses.find((item) => item.key === statusKey(task));
    const current = statusCounts.get(key) || { label: column?.name || column?.title || fallback?.label || "To do", count: 0 };
    statusCounts.set(key, { ...current, count: current.count + 1 });
  }

  const membersById = new Map(members.map((member) => [member.userId, member]));
  const assigneeCounts = new Map();
  for (const task of tasks) {
    const member = membersById.get(task.assigneeId);
    const label = task.assigneeId
      ? task.assigneeName || (member ? safeDisplayName(member) : "TaskFlow user")
      : "Unassigned";
    assigneeCounts.set(label, (assigneeCounts.get(label) || 0) + 1);
  }

  return (
    <section className="story-workload-overview" aria-label="Story progress overview">
      <div className="story-workload-heading">
        <div><h3>Progress</h3><p>{percentage}% complete</p></div>
        <strong>{completed}/{total}</strong>
      </div>
      <div className="story-progress-track" role="progressbar" aria-label="Story completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <div className="story-workload-stats">
        <span><strong>{total}</strong><small>Total tasks</small></span>
        <span><strong>{completed}</strong><small>Completed</small></span>
        <span><strong>{remaining}</strong><small>Remaining</small></span>
      </div>
      <div className="story-workload-breakdowns">
        <div className="story-status-breakdown" aria-label="Tasks by status">
          <h4>Status</h4>
          <div>{[...statusCounts.entries()].map(([key, item]) => <span key={key}><i aria-hidden="true" /><small>{item.label}</small><strong>{item.count}</strong></span>)}</div>
        </div>
        {assigneeCounts.size > 0 && (
          <div className="story-assignee-breakdown" aria-label="Tasks by assignee">
            <h4>Assignees</h4>
            <div>{[...assigneeCounts.entries()].map(([label, count]) => <span key={label}><i aria-hidden="true">{label.slice(0, 1).toUpperCase()}</i><small>{label}</small><strong>{count}</strong></span>)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
