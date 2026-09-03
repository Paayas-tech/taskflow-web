import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "../ui/Avatar";
import { Checkbox } from "../ui/Field";
import { Icon, PriorityIcon } from "../ui/icons";
import { cx } from "../ui/cx";
import { isTaskComplete } from "../domain/taskDomain";
import { formatDateOnlyForDisplay } from "../domain/settingsDomain";
import { safeDisplayName } from "../domain/identityDomain";
import { dueDateTone, formatDueLabel } from "./taskPresentation";

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
  context = {},
  onOpen,
  selected = false,
  selectable = false,
  selectedForBulk = false,
  onToggleSelect,
  readOnly = false,
  todayKey,
  formatSettings = {},
  className,
  ...rest
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    disabled: readOnly,
  });
  const { membersById } = context;
  const completed = isTaskComplete(task);
  const dueDate = typeof task.dueDate === "string" ? task.dueDate.trim() : "";
  const dueLabel = formatDueLabel(dueDate, todayKey);
  const tone = dueDateTone(dueDate, todayKey, completed);
  const member = membersById?.get?.(task.assigneeId);
  const assigneeName =
    task.assigneeName || (member ? safeDisplayName(member) : "TaskFlow user");

  return (
    <article
      ref={setNodeRef}
      className={cx(
        "task-card",
        isDragging && "is-dragging",
        selected && "is-selected",
        completed && "is-complete",
        selectedForBulk && "is-bulk-selected",
        className
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
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

      <button
        type="button"
        className="task-card-open"
        onClick={(event) => onOpen?.(task, event.currentTarget)}
        disabled={!onOpen}
      >
        <span className="task-card-title">{task.title}</span>
      </button>

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
            title={formatDateOnlyForDisplay(dueDate, formatSettings.dateFormat)}
          >
            {dueLabel}
          </time>
        ) : null}
        <span className="task-card-spacer" />
        {task.assigneeId ? <Avatar size="sm" name={assigneeName} /> : null}
      </div>
    </article>
  );
}

export default TaskCard;
