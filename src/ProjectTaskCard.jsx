import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const priorityLabel = (priority) =>
  priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";

export default function ProjectTaskCard({ task, onEdit, readOnly = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task:${task.id}`, disabled: readOnly });

  return (
    <article
      ref={setNodeRef}
      className={`project-task-card${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="project-task-drag-handle"
        type="button"
        aria-label={`Move ${task.title}`}
        disabled={readOnly}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
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
          {task.assigneeId && (
            <span title={`Assigned to ${task.assigneeId}`}>
              Assigned · {task.assigneeId.slice(0, 8)}
            </span>
          )}
        </span>
      </button>
    </article>
  );
}
