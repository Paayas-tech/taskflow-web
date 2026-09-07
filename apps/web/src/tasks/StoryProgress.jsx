import { StatusIcon } from "../ui/icons";
import { cx } from "../ui/primitives";
import { isTaskComplete, statusLabel } from "../domain/task";
import { groupProjectTasksByColumn } from "../domain/board";

const STATUSES = ["todo", "in-progress", "completed"];

const statusOf = (task) => {
  if (isTaskComplete(task)) return "completed";
  return task.status === "in-progress" || task.status === "in_progress"
    ? "in-progress"
    : "todo";
};

const statusForCategory = (category) => {
  if (category === "done") return "completed";
  if (category === "in_progress" || category === "in-progress") return "in-progress";
  return "todo";
};

/**
 * Completion bar and per-status counts for a story's linked tasks. With project
 * `columns` the counts follow the board columns instead of the three statuses.
 */
export function StoryProgress({ tasks = [], columns = [], className, ...rest }) {
  const total = tasks.length;
  const completed = tasks.filter(isTaskComplete).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  let stats;
  if (columns.length > 0) {
    const tasksByColumn = groupProjectTasksByColumn(columns, tasks);
    stats = columns.map((column) => ({
      key: column.id,
      label: column.name,
      status: statusForCategory(column.category),
      count: (tasksByColumn.get(column.id) || []).length,
    }));
  } else {
    const counts = new Map(STATUSES.map((status) => [status, 0]));
    tasks.forEach((task) => {
      const status = statusOf(task);
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    stats = STATUSES.map((status) => ({
      key: status,
      label: statusLabel(status),
      status,
      count: counts.get(status) || 0,
    }));
  }

  return (
    <div className={cx("story-progress", className)} {...rest}>
      <div className="story-progress-head">
        <strong className="story-progress-count">{`${completed}/${total} done`}</strong>
        <span className="story-progress-percent muted">{`${percentage}%`}</span>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-label="Story completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <span className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>

      <ul className="story-progress-stats">
        {stats.map((stat) => (
          <li key={stat.key} className="story-progress-stat">
            <StatusIcon status={stat.status} size={14} />
            <span className="story-progress-stat-label">{stat.label}</span>
            <strong>{stat.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
