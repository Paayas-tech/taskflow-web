import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, cx } from "../ui/primitives";
import { Checkbox } from "../ui/Field";
import { Icon, PriorityIcon } from "../ui/icons";
import { dueDateTone, formatDueLabel, isTaskComplete } from "../domain/task";
import { formatDateOnlyForDisplay } from "../domain/settings";
import { selectProject, selectSettings } from "../store/selectors";
import { useStore } from "../store/store";
import { openTask, openTaskInProject } from "../store/ui";

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.stopPropagation();
  }
};

/**
 * A board card. The whole card is the drag handle (6px activation distance), so
 * a plain click still reaches the inner button and opens the task.
 */
export function TaskCard({
  task,
  onOpen,
  selected = false,
  selectable = false,
  selectedForBulk = false,
  onToggleSelect,
  readOnly = false,
  todayKey,
  className,
  ...rest
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    disabled: readOnly,
  });
  const settings = useStore(selectSettings);
  const project = useStore(selectProject(task.projectId));

  const completed = isTaskComplete(task);
  const dueDate = typeof task.dueDate === "string" ? task.dueDate.trim() : "";
  const dueLabel = formatDueLabel(dueDate, todayKey);
  const tone = dueDateTone(dueDate, todayKey, completed);
  const projectName = task.projectName || project?.name || "";

  const open = (element) => {
    if (onOpen) onOpen(task, element);
    else openTask(task.id);
  };

  const openProject = (event) => {
    event.stopPropagation();
    openTaskInProject(task);
  };

  return (
    <article
      ref={setNodeRef}
      className={cx(
        "task-card",
        isDragging && "is-dragging",
        selected && "is-selected",
        completed && "is-complete",
        selectedForBulk && "is-bulk-selected",
        readOnly && "is-read-only",
        className
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={task.title}
      onClick={(event) => open(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open(event.currentTarget);
      }}
      {...rest}
    >
      {selectable ? (
        <span className="task-card-select" onClick={stopPointer} onKeyDown={stopKeys}>
          <Checkbox
            checked={selectedForBulk}
            aria-label={`Select ${task.title}`}
            onChange={() => onToggleSelect?.(task.id)}
          />
        </span>
      ) : null}

      <div className="task-card-body">
        <span className="task-card-title">{task.title}</span>
      </div>

      {projectName ? (
        task.projectId ? (
          <button
            type="button"
            className="task-badge task-badge-project is-link"
            title="Open project"
            aria-label={`Open ${projectName} project`}
            onClick={openProject}
            onPointerDown={stopPointer}
            onKeyDown={stopKeys}
          >
            <span
              className="task-badge-dot"
              style={{ backgroundColor: project?.color || "var(--color-accent)" }}
              aria-hidden="true"
            />
            {projectName}
          </button>
        ) : (
          <span className="task-badge task-badge-project" title={projectName}>
            <span className="task-badge-dot" style={{ backgroundColor: "var(--color-accent)" }} aria-hidden="true" />
            {projectName}
          </span>
        )
      ) : null}

      {task.storyName ? (
        <span className="task-badge task-badge-story" title={`Story: ${task.storyName}`}>
          <Icon name="book" size={12} />
          {task.storyName}
        </span>
      ) : null}

      <div className="task-card-footer">
        <PriorityIcon priority={task.priority} size={14} />
        {dueLabel ? (
          <time
            className={cx("task-due", `is-${tone}`)}
            dateTime={dueDate}
            title={formatDateOnlyForDisplay(dueDate, settings.time.dateFormat)}
          >
            {dueLabel}
          </time>
        ) : null}
        <span className="task-card-spacer" />
        {task.assigneeId ? <Avatar size="sm" name={task.assigneeName || "TaskFlow user"} /> : null}
      </div>
    </article>
  );
}
