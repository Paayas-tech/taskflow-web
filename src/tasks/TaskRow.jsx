import { Avatar, Badge, Spinner, cx } from "../ui/primitives";
import { IconButton } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Icon, PriorityIcon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import {
  dueDateTone,
  formatDueLabel,
  isArchived,
  isTaskComplete,
} from "../domain/task";
import { formatDateOnlyForDisplay } from "../domain/settings";
import {
  selectPending,
  selectProject,
  selectSettings,
} from "../store/selectors";
import { useStore } from "../store/store";
import { toggleComplete } from "../store/tasks";
import { openTask, openTaskInProject } from "../store/ui";

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.stopPropagation();
  }
};

/**
 * The single task row used by every list in the app. It takes an enriched task
 * (from the selectors) and reads everything else it needs — the busy state, the
 * project color, the date format — from the store.
 */
export function TaskRow({
  task,
  selected = false,
  onOpen,
  onArchive,
  onRestore,
  onDeletePermanently,
  readOnly = false,
  showProject = true,
  showStory = true,
  showAssignee = true,
  dense = false,
  todayKey,
  selectable = false,
  selectedForBulk = false,
  onToggleSelect,
  className,
  ...rest
}) {
  const settings = useStore(selectSettings);
  const pending = useStore(selectPending);
  const project = useStore(selectProject(task.projectId));

  const busy = (pending[task.id] || 0) > 0;
  const completed = isTaskComplete(task);
  const archived = isArchived(task);
  const googleEvent = task.source === "google";
  const projectName = task.projectName || project?.name || "";
  const dueDate = typeof task.dueDate === "string" ? task.dueDate.trim() : "";
  const tone = dueDateTone(dueDate, todayKey, completed);
  const dueLabel = formatDueLabel(dueDate, todayKey);
  const attachmentCount = Number(task.attachmentCount) || 0;
  const attachmentLabel = `${attachmentCount} ${attachmentCount === 1 ? "attachment" : "attachments"}`;
  const completeLabel = completed
    ? `Mark ${task.title} incomplete`
    : `Mark ${task.title} complete`;

  const open = (element) => {
    if (onOpen) onOpen(task, element);
    else openTask(task.id);
  };

  const openProject = (event) => {
    event.stopPropagation();
    openTaskInProject(task);
  };

  const projectBadge = projectName ? (
    <span className="task-badge-dot" style={{ backgroundColor: project?.color || "var(--color-accent)" }} aria-hidden="true" />
  ) : null;

  const menuItems = [
    { id: "open", label: "Open", icon: <Icon name="external-link" />, onSelect: () => open(null) },
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
        <button
          type="button"
          role="checkbox"
          aria-checked={completed}
          aria-label={completeLabel}
          title={completeLabel}
          className={cx(
            "task-check",
            dense && "task-check-sm",
            completed && "is-complete",
            busy && "is-busy"
          )}
          disabled={readOnly || busy}
          onClick={(event) => {
            event.stopPropagation();
            if (readOnly || busy) return;
            void toggleComplete(task.id);
          }}
          onKeyDown={stopKeys}
        >
          {busy ? <Spinner size="sm" /> : <Icon name="check" size={12} className="task-check-mark" />}
        </button>
      )}

      <div className="task-row-main">
        <span className="task-row-title truncate" title={task.title}>
          {task.title}
        </span>
        {(showProject && projectName) || (showStory && task.storyName) ? (
          <span className="task-row-badges">
            {showProject && projectName ? (
              task.projectId ? (
                <button
                  type="button"
                  className="task-badge task-badge-project is-link"
                  title="Open project"
                  aria-label={`Open ${projectName} project`}
                  onClick={openProject}
                  onKeyDown={stopKeys}
                >
                  {projectBadge}
                  {projectName}
                </button>
              ) : (
                <span className="task-badge task-badge-project" title={projectName}>
                  {projectBadge}
                  {projectName}
                </span>
              )
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
            title={formatDateOnlyForDisplay(dueDate, settings.time.dateFormat)}
          >
            <Icon name="calendar" size={12} />
            {dueLabel}
          </time>
        ) : null}

        <PriorityIcon priority={task.priority} size={14} />

        {showAssignee && task.assigneeId ? (
          <Avatar size="sm" name={task.assigneeName || "TaskFlow user"} />
        ) : null}

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
      </div>
    </div>
  );
}
