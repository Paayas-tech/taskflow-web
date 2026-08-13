import {
  classifyDateOnly,
  dateOnlyKey,
  formatTaskDueDate,
  isTaskComplete,
} from "./domain/taskDomain";

const statusLabels = {
  todo: "To do",
  "in-progress": "In progress",
  completed: "Completed",
};

const priorityLabels = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

const legacyListColors = {
  "#a45139": "#6657c8",
  "#66806a": "#4f8a68",
  "#a9656a": "#ad5c74",
  "#b17a3e": "#b77a24",
  "#6f7f86": "#64748b",
};

const displayListColor = (color) =>
  legacyListColors[color?.toLowerCase()] || color || "#7d71cf";

const dueDateMetaFor = (value) => {
  if (!value) return { label: "No due date", tone: "undated" };

  const todayKey = dateOnlyKey(new Date());
  const dateGroup = classifyDateOnly(value, todayKey);
  if (dateGroup === "overdue") {
    return { label: `Overdue · ${formatTaskDueDate(value)}`, tone: "overdue" };
  }
  if (dateGroup === "today") return { label: "Due today", tone: "today" };

  return { label: formatTaskDueDate(value), tone: "upcoming" };
};

export default function TaskRow({
  task,
  lists,
  projects = [],
  completionBusy = false,
  selected = false,
  onToggleCompletion,
  onEdit,
}) {
  const completed = isTaskComplete(task);
  const taskList = lists.find((list) => list.id === task.listId);
  const taskProject = projects.find((project) => project.id === task.projectId);
  const dueDateMeta = dueDateMetaFor(task.dueDate);

  return (
    <article
      className={`tasks-page-row ${completed ? "task-row-completed" : ""} ${
        selected ? "is-selected" : ""
      }`}
      aria-busy={completionBusy}
    >
      <button
        type="button"
        className={`completion-control ${completed ? "is-complete" : ""}`}
        aria-label={
          completed
            ? `Mark ${task.title} incomplete`
            : `Mark ${task.title} complete`
        }
        aria-pressed={completed}
        onClick={() => onToggleCompletion(task)}
      >
        {completionBusy ? (
          <span className="completion-spinner" />
        ) : (
          <span aria-hidden="true">{completed ? "✓" : ""}</span>
        )}
      </button>

      <div className="tasks-page-copy">
        <button
          className="task-title-button"
          type="button"
          onClick={(event) => onEdit(task, event.currentTarget)}
          disabled={completionBusy}
        >
          <span className="task-row-title">{task.title}</span>
        </button>
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
        {task.notes && (
          <p className="task-notes-preview">
            <strong>Notes:</strong> {task.notes}
          </p>
        )}
        <div className="tasks-page-meta">
          <span className="task-list-badge">
            <span
              className="list-color-dot"
              style={{ backgroundColor: displayListColor(taskList?.color) }}
              aria-hidden="true"
            />
            {taskList?.name || "Inbox"}
          </span>
          {taskProject && (
            <span className="task-project-badge">
              <span
                className="project-color-dot"
                style={{ backgroundColor: taskProject.color || "#6657c8" }}
                aria-hidden="true"
              />
              {taskProject.name}
            </span>
          )}
          <span className={`task-due-meta task-due-${dueDateMeta.tone}`}>
            {dueDateMeta.label}
          </span>
          <span className={`priority priority-${task.priority}`}>
            {priorityLabels[task.priority] || "Medium priority"}
          </span>
          {task.reminder && (
            <span className="task-reminder-meta">Reminder</span>
          )}
        </div>
      </div>

      <div className="task-row-actions">
        <span className={`task-status task-status-${task.status}`}>
          {statusLabels[task.status] || "To do"}
        </span>
        <button
          className="ghost-btn compact-btn task-edit-button"
          type="button"
          onClick={(event) => onEdit(task, event.currentTarget)}
          disabled={completionBusy}
          aria-label={`Edit ${task.title}`}
        >
          Edit
        </button>
      </div>
    </article>
  );
}
