import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const priorityLabel = (priority) =>
  priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";

const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

export default function ProjectTaskCard({ task, onEdit, readOnly = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task:${task.id}`, disabled: readOnly });
  const assigneeName = task.assigneeId
    ? task.assigneeName || "TaskFlow user"
    : "Unassigned";

  return (
    <article
      ref={setNodeRef}
      className={`project-task-card${isDragging ? " is-dragging" : ""}${readOnly ? " is-read-only" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {!readOnly && (
        <button
          className="project-task-drag-handle"
          type="button"
          aria-label={`Move ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      )}
      <button
        className="project-task-card-content"
        type="button"
        onClick={(event) => onEdit?.(task, event.currentTarget)}
        disabled={!onEdit}
      >
        <strong>{task.title}</strong>
        {task.description && <span>{task.description}</span>}
        <span className="project-task-card-meta">
          <span className={`task-priority priority-${task.priority}`}>
            {priorityLabel(task.priority)}
          </span>
          {task.dueDate && <time dateTime={task.dueDate}>{task.dueDate}</time>}
        </span>
        <span
          className={`project-task-assignee${task.assigneeId ? "" : " is-unassigned"}`}
          title={task.assigneeId ? `Assigned to ${assigneeName}` : "No assignee"}
        >
          <span className="project-task-assignee-avatar" aria-hidden="true">
            {task.assigneeId ? initials(assigneeName) : "—"}
          </span>
          <span>{assigneeName}</span>
        </span>
      </button>
    </article>
  );
}
