/**
 * Project stories tab: one row per story with its task progress, plus the
 * archived stories that can be restored.
 */
import { Avatar, Badge, EmptyState, cx } from "../ui/primitives";
import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";
import { dueDateTone, formatDueLabel, isTaskComplete, statusLabel } from "../domain/task";
import { groupProjectTasksByColumn } from "../domain/board";
import { safeDisplayName } from "../domain/collaboration";

const STATUSES = ["todo", "in-progress", "completed"];

const STATUS_TONES = { todo: "neutral", "in-progress": "warning", completed: "success" };

const statusOf = (task) => {
  if (isTaskComplete(task)) return "completed";
  return task.status === "in-progress" || task.status === "in_progress"
    ? "in-progress"
    : "todo";
};

const assigneeLabel = (story, membersById) =>
  story.assigneeName || safeDisplayName(membersById.get(story.assigneeId));

/** `To do 2 · In progress 1 · Done 3`, following the board columns when there are any. */
const breakdownLabel = (storyTasks, columns) => {
  if (storyTasks.length === 0) return "No tasks yet";
  if (columns.length > 0) {
    const tasksByColumn = groupProjectTasksByColumn(columns, storyTasks);
    return columns
      .map((column) => `${column.name} ${(tasksByColumn.get(column.id) || []).length}`)
      .join(" · ");
  }
  const counts = new Map(STATUSES.map((status) => [status, 0]));
  storyTasks.forEach((task) => {
    const status = statusOf(task);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return STATUSES.map((status) => `${statusLabel(status)} ${counts.get(status)}`).join(" · ");
};

export function ProjectStoriesTab({
  stories = [],
  tasks = [],
  members = [],
  columns = [],
  selectedStoryId = null,
  onOpenStory,
  onNewStory,
  archivedStories = [],
  onRestoreStory,
  restoringId = null,
  readOnly = false,
  todayKey,
}) {
  const membersById = new Map(members.map((member) => [member.userId, member]));

  const openStory = (story) => onOpenStory?.(story);

  return (
    <section className="stories-tab stack-4" aria-label="Project stories">
      {stories.length === 0 ? (
        <EmptyState
          icon="book"
          title="No stories yet"
          description="Stories group related tasks."
          action={
            readOnly ? null : (
              <Button variant="primary" icon={<Icon name="plus" />} onClick={onNewStory}>
                New story
              </Button>
            )
          }
        />
      ) : (
        <div className="row-list">
          {stories.map((story) => {
            const storyTasks = tasks.filter((task) => task.storyId === story.id);
            const completed = storyTasks.filter(isTaskComplete).length;
            const percentage =
              storyTasks.length > 0
                ? Math.round((completed / storyTasks.length) * 100)
                : 0;
            const status = statusOf(story);
            const dueDate = typeof story.dueDate === "string" ? story.dueDate.trim() : "";
            const dueLabel = formatDueLabel(dueDate, todayKey);
            const selected = selectedStoryId === story.id;

            return (
              <div
                key={story.id}
                className={cx("story-row", selected && "is-selected")}
                role="button"
                tabIndex={0}
                aria-current={selected ? "true" : undefined}
                onClick={() => openStory(story)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  openStory(story);
                }}
              >
                <span className="story-row-icon" aria-hidden="true">
                  <Icon name="book" />
                </span>

                <div className="story-row-main">
                  <span className="story-row-title truncate" title={story.title}>
                    {story.title}
                  </span>
                  {story.description ? (
                    <span
                      className="story-row-description truncate muted"
                      title={story.description}
                    >
                      {story.description}
                    </span>
                  ) : null}
                </div>

                <div className="story-row-meta">
                  <span
                    className="story-row-progress"
                    title={breakdownLabel(storyTasks, columns)}
                  >
                    <span
                      className="progress story-row-bar"
                      role="progressbar"
                      aria-label={`${story.title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <span className="progress-fill" style={{ width: `${percentage}%` }} />
                    </span>
                    <span className="story-row-count muted">
                      {`${completed}/${storyTasks.length}`}
                    </span>
                  </span>

                  <Badge tone={STATUS_TONES[status]}>{statusLabel(status)}</Badge>

                  {dueLabel ? (
                    <time
                      className={cx(
                        "task-due",
                        `is-${dueDateTone(dueDate, todayKey, status === "completed")}`
                      )}
                      dateTime={dueDate}
                    >
                      <Icon name="calendar" size={12} />
                      {dueLabel}
                    </time>
                  ) : null}

                  {story.assigneeId ? (
                    <Avatar size="sm" name={assigneeLabel(story, membersById)} />
                  ) : null}

                  <Icon name="chevron-right" className="story-row-chevron" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && archivedStories.length > 0 ? (
        <details className="archived-stories">
          <summary>{`Archived stories (${archivedStories.length})`}</summary>
          <div className="row-list">
            {archivedStories.map((story) => (
              <div className="story-row is-archived" key={story.id}>
                <span className="story-row-icon" aria-hidden="true">
                  <Icon name="book" />
                </span>
                <span className="story-row-title truncate" title={story.title}>
                  {story.title}
                </span>
                <Button
                  size="sm"
                  loading={restoringId === story.id}
                  disabled={Boolean(restoringId)}
                  onClick={() => onRestoreStory?.(story.id)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
