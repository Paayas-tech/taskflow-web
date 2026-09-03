import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Icon, PriorityIcon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import { cx } from "../ui/cx";
import { isArchived, isTaskComplete } from "../domain/taskDomain";
import { formatDateOnlyForDisplay } from "../domain/settingsDomain";
import { safeDisplayName } from "../domain/identityDomain";
import { dueDateTone, formatDueLabel } from "./taskPresentation";
import { TaskCheckbox } from "./TaskCheckbox";

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.stopPropagation();
  }
};

const assigneeLabel = (task, membersById) => {
  const member = membersById?.get?.(task.assigneeId);
  return task.assigneeName || (member ? safeDisplayName(member) : "TaskFlow user");
};

/** The single task row used by every list in the app. */
export function TaskRow({
  task,
  context = {},
  selected = false,
  onOpen,
  onToggleComplete,
  onArchive,
  onRestore,
  onDeletePermanently,
  busy = false,
  readOnly = false,
  showProject = true,
  showStory = true,
  showAssignee = true,
  dense = false,
  todayKey,
  selectable = false,
  selectedForBulk = false,
  onToggleSelect,
  formatSettings = {},
  className,
  ...rest
}) {
  const { projectsById, membersById } = context;
  const completed = isTaskComplete(task);
  const archived = isArchived(task);
  const googleEvent = task.source === "google";
  const project = task.projectId ? projectsById?.get?.(task.projectId) : null;
  const projectName = project?.name || task.projectName || "";
  const dueDate = typeof task.dueDate === "string" ? task.dueDate.trim() : "";
  const tone = dueDateTone(dueDate, todayKey, completed);
  const dueLabel = formatDueLabel(dueDate, todayKey);
  const attachmentCount = Number(task.attachmentCount) || 0;
  const attachmentLabel = `${attachmentCount} ${attachmentCount === 1 ? "attachment" : "attachments"}`;

  const open = (element) => onOpen?.(task, element);

  const menuItems = [
    onOpen && { id: "open", label: "Open", icon: <Icon name="external-link" />, onSelect: () => open(null) },
    !readOnly && !archived && onArchive
      ? { id: "archive", label: "Archive", icon: <Icon name="archive" />, onSelect: () => onArchive(task) }
      : null,
    !readOnly && onRestore
      ? { id: "restore", label: "Restore", icon: <Icon name="archive-restore" />, onSelect: () => onRestore(task) }
      : null,
    !readOnly && onDeletePermanently
      ? {
          id: "delete",
          label: "Delete permanently",
          icon: <Icon name="trash" />,
          danger: true,
          onSelect: () => onDeletePermanently(task),
        }
      : null,
  ].filter(Boolean);

  return (
    <div
      className={cx(
        "task-row",
        selected && "is-selected",
        completed && "is-complete",
        dense && "is-dense",
        archived && "is-archived",
        selectedForBulk && "is-bulk-selected",
        className
      )}
      role="button"
      tabIndex={0}
      aria-busy={busy || undefined}
      onClick={(event) => open(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open(event.currentTarget);
      }}
      {...rest}
    >
      {selectable ? (
        <span className="task-row-select" onClick={stopPointer} onKeyDown={stopKeys}>
          <Checkbox
            checked={selectedForBulk}
            aria-label={`Select ${task.title}`}
            disabled={busy}
            onChange={() => onToggleSelect?.(task.id)}
          />
        </span>
      ) : null}

      {googleEvent ? (
        <Badge tone="info" className="task-row-source" title="Google Calendar event">
          G
        </Badge>
      ) : archived ? (
        <Badge tone="neutral" className="task-row-archived-badge">
          Archived
        </Badge>
      ) : (
        <TaskCheckbox
          checked={completed}
          busy={busy}
          disabled={readOnly || !onToggleComplete}
          size={dense ? "sm" : "md"}
          label={completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
          onChange={() => onToggleComplete?.(task)}
        />
      )}

      <div className="task-row-main">
        <span className="task-row-title truncate" title={task.title}>
          {task.title}
        </span>
        {(showProject && projectName) || (showStory && task.storyName) ? (
          <span className="task-row-badges">
            {showProject && projectName ? (
              <span className="task-badge task-badge-project" title={projectName}>
                <span
                  className="task-badge-dot"
                  style={{ backgroundColor: project?.color || "var(--color-accent)" }}
                  aria-hidden="true"
                />
                {projectName}
              </span>
            ) : null}
            {showStory && task.storyName ? (
              <span className="task-badge task-badge-story" title={`Story: ${task.storyName}`}>
                <Icon name="book" size={12} />
                {task.storyName}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="task-row-meta">
        {attachmentCount > 0 ? (
          <span className="task-row-attachments" aria-label={attachmentLabel} title={attachmentLabel}>
            <Icon name="paperclip" size={12} />
            {attachmentCount}
          </span>
        ) : null}

        {dueLabel ? (
          <time
            className={cx("task-due", `is-${tone}`)}
            dateTime={dueDate}
            title={formatDateOnlyForDisplay(dueDate, formatSettings.dateFormat)}
          >
            <Icon name="calendar" size={12} />
            {dueLabel}
          </time>
        ) : null}

        <PriorityIcon priority={task.priority} size={14} />

        {showAssignee && task.assigneeId ? (
          <Avatar size="sm" name={assigneeLabel(task, membersById)} />
        ) : null}

        {menuItems.length > 0 ? (
          <span className="task-row-menu" onClick={stopPointer} onKeyDown={stopKeys}>
            <Menu
              align="end"
              items={menuItems}
              trigger={(triggerProps) => (
                <IconButton label={`More actions for ${task.title}`} size="sm" {...triggerProps}>
                  <Icon name="more-horizontal" />
                </IconButton>
              )}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default TaskRow;
