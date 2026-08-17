import { useState } from "react";
import {
  classifyDateOnly,
  dateOnlyKey,
  isArchived,
  isTaskComplete,
} from "./domain/taskDomain";
import {
  formatReminderMetadata,
  isReminderDue,
} from "./domain/reminderDomain";
import { formatDateOnlyForDisplay } from "./domain/settingsDomain";

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

const dueDateMetaFor = (value, dateFormat) => {
  if (!value) return { label: "No due date", tone: "undated" };

  const todayKey = dateOnlyKey(new Date());
  const dateGroup = classifyDateOnly(value, todayKey);
  if (dateGroup === "overdue") {
    return {
      label: `Overdue · ${formatDateOnlyForDisplay(value, dateFormat)}`,
      tone: "overdue",
    };
  }
  if (dateGroup === "today") return { label: "Due today", tone: "today" };

  return { label: formatDateOnlyForDisplay(value, dateFormat), tone: "upcoming" };
};

const formatArchivedDate = (value, dateFormat) => {
  const archivedDate = new Date(value);
  if (Number.isNaN(archivedDate.getTime())) return "Archived";

  const dateOnly = `${archivedDate.getFullYear()}-${String(
    archivedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(archivedDate.getDate()).padStart(2, "0")}`;
  return `Archived ${formatDateOnlyForDisplay(dateOnly, dateFormat)}`;
};

export default function TaskRow({
  task,
  lists,
  projects = [],
  completionBusy = false,
  actionBusy = false,
  selected = false,
  onToggleCompletion,
  onEdit,
  onArchive,
  onRestore,
  onDeletePermanently,
  formatSettings = {},
}) {
  const [localActionBusy, setLocalActionBusy] = useState(false);
  const completed = isTaskComplete(task);
  const archived = isArchived(task);
  const lifecycleBusy = actionBusy || localActionBusy;
  const taskList = lists.find((list) => list.id === task.listId);
  const taskProject = projects.find((project) => project.id === task.projectId);
  const dueDateMeta = dueDateMetaFor(task.dueDate, formatSettings.dateFormat);
  const reminderDue = isReminderDue(task);
  const reminderMeta = task.reminderAt
    ? formatReminderMetadata(task.reminderAt, new Date(), {
        timeFormat: formatSettings.format,
      })
    : "Reminder";

  const runLifecycleAction = async (action) => {
    if (!action || lifecycleBusy) return;

    setLocalActionBusy(true);
    try {
      await action(task);
    } finally {
      setLocalActionBusy(false);
    }
  };

  return (
    <article
      className={`tasks-page-row ${completed ? "task-row-completed" : ""} ${
        archived ? "task-row-archived" : ""
      } ${selected ? "is-selected" : ""} ${
        reminderDue ? "task-row-reminder-due" : ""
      }`}
      aria-busy={completionBusy || lifecycleBusy}
    >
      {archived ? (
        <span className="archive-status-icon" aria-hidden="true">A</span>
      ) : (
        <button
          type="button"
          className={`completion-control ${completed ? "is-complete" : ""}`}
          aria-label={
            completed
              ? `Mark ${task.title} incomplete`
              : `Mark ${task.title} complete`
          }
          aria-pressed={completed}
          onClick={() => onToggleCompletion?.(task)}
          disabled={lifecycleBusy || !onToggleCompletion}
        >
          {completionBusy ? (
            <span className="completion-spinner" />
          ) : (
            <span aria-hidden="true">{completed ? "✓" : ""}</span>
          )}
        </button>
      )}

      <div className="tasks-page-copy">
        <button
          className="task-title-button"
          type="button"
          onClick={(event) => onEdit?.(task, event.currentTarget)}
          disabled={completionBusy || lifecycleBusy || !onEdit}
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
          {task.assigneeId && (
            <span className="task-project-badge" title={`Assigned to ${task.assigneeId}`}>
              <span className="sidebar-avatar" aria-hidden="true">
                {task.assigneeId.slice(0, 1).toUpperCase()}
              </span>
              {task.assigneeId}
            </span>
          )}
          <span className={`task-due-meta task-due-${dueDateMeta.tone}`}>
            {dueDateMeta.label}
          </span>
          <span className={`priority priority-${task.priority}`}>
            {priorityLabels[task.priority] || "Medium priority"}
          </span>
          {task.reminder && (
            <span className={`task-reminder-meta ${reminderDue ? "is-due" : ""}`}>
              {reminderMeta}
            </span>
          )}
          {archived && (
            <span className="task-archived-meta">
              {formatArchivedDate(task.archivedAt, formatSettings.dateFormat)}
            </span>
          )}
        </div>
      </div>

      <div className="task-row-actions">
        <span className={`task-status task-status-${task.status}`}>
          {statusLabels[task.status] || "To do"}
        </span>
        {onEdit && (
          <button
            className="ghost-btn compact-btn task-edit-button"
            type="button"
            onClick={(event) => onEdit(task, event.currentTarget)}
            disabled={completionBusy || lifecycleBusy}
            aria-label={`Edit ${task.title}`}
          >
            Edit
          </button>
        )}
        {!archived && onArchive && (
          <button
            className="ghost-btn compact-btn task-archive-button"
            type="button"
            onClick={() => void runLifecycleAction(onArchive)}
            disabled={completionBusy || lifecycleBusy}
          >
            {lifecycleBusy ? "Archiving..." : "Archive"}
          </button>
        )}
        {archived && onRestore && (
          <button
            className="secondary-btn compact-btn task-restore-button"
            type="button"
            onClick={() => void runLifecycleAction(onRestore)}
            disabled={lifecycleBusy}
          >
            {lifecycleBusy ? "Restoring..." : "Restore"}
          </button>
        )}
        {archived && onDeletePermanently && (
          <button
            className="danger-btn compact-btn task-delete-permanently-button"
            type="button"
            onClick={() => void runLifecycleAction(onDeletePermanently)}
            disabled={lifecycleBusy}
          >
            Delete permanently
          </button>
        )}
      </div>
    </article>
  );
}
