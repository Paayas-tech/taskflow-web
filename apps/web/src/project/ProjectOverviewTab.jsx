/**
 * Project overview: status distribution, overdue and recently completed work,
 * project details and members. Every number is derived from the workspace
 * tasks already in the store — there is no separate overview request.
 */
import { useMemo } from "react";
import { Avatar, Badge, EmptyState, InlineNotice, cx } from "../ui/primitives";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";
import { safeDisplayName } from "../domain/collaboration";
import {
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  formatOverviewDate,
  isTaskComplete,
  PROJECT_HEALTH_OPTIONS,
  statusLabel,
  taskTimestampToMillis,
} from "../domain/task";
import { ensureWorkspace, setProjectHealth } from "../store/projects";
import { openTask } from "../store/ui";
import { selectWorkspace } from "../store/selectors";
import { useStore } from "../store/store";

const MEMBER_LIMIT = 8;
const TASK_LIMIT = 10;

const HEALTH_TONES = {
  on_track: "success",
  at_risk: "warning",
  off_track: "danger",
  on_hold: "neutral",
  complete: "info",
};

const STATUS_ORDER = ["todo", "in-progress", "completed"];

const BAR_TONES = {
  todo: "is-todo",
  "in-progress": "is-progress",
  completed: "is-done",
};

const ROLE_LABELS = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const roleLabel = (role) => ROLE_LABELS[role] || "Member";

const healthLabel = (value) =>
  PROJECT_HEALTH_OPTIONS.find((option) => option.value === value)?.label || "On track";

const statusOf = (task) => {
  if (isTaskComplete(task)) return "completed";
  return task.status === "in-progress" || task.status === "in_progress"
    ? "in-progress"
    : "todo";
};

const assigneeName = (task) =>
  task.assigneeId ? task.assigneeName || "TaskFlow user" : "Unassigned";

/** Everything the tab charts, in one pass over the project's active tasks. */
const overviewFrom = (tasks, todayKey) => {
  const distribution = { todo: 0, "in-progress": 0, completed: 0 };
  let overdue = 0;

  tasks.forEach((task) => {
    const status = statusOf(task);
    distribution[status] += 1;
    if (status !== "completed" && classifyDateOnly(task.dueDate, todayKey) === "overdue") {
      overdue += 1;
    }
  });

  const overdueTasks = tasks
    .filter(
      (task) =>
        !isTaskComplete(task) && classifyDateOnly(task.dueDate, todayKey) === "overdue"
    )
    .sort((first, second) => compareDateOnly(first.dueDate, second.dueDate))
    .slice(0, TASK_LIMIT);

  const recentlyCompletedTasks = tasks
    .filter(isTaskComplete)
    .sort(
      (first, second) =>
        (taskTimestampToMillis(second.completedAt) ?? 0) -
        (taskTimestampToMillis(first.completedAt) ?? 0)
    )
    .slice(0, TASK_LIMIT);

  return {
    metrics: {
      total: tasks.length,
      completed: distribution.completed,
      inProgress: distribution["in-progress"],
      overdue,
    },
    statusDistribution: STATUS_ORDER.filter(
      (status) => distribution[status] > 0
    ).map((status) => [status, distribution[status]]),
    overdueTasks,
    recentlyCompletedTasks,
  };
};

function OverviewSkeleton() {
  return (
    <section
      className="overview-tab is-loading"
      role="status"
      aria-label="Loading project overview"
    >
      <div className="overview-grid">
        {[0, 1].map((column) => (
          <div className="stack-4" key={column}>
            {[0, 1].map((card) => (
              <div className="card stack-3" key={card}>
                <span className="skeleton overview-skeleton-line" />
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function OverviewTaskRow({ task, dateValue, tone, statusBadge = false }) {
  const open = () => openTask(task.id);
  const name = assigneeName(task);

  return (
    <div
      className="overview-task-row"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      }}
    >
      <span className="overview-task-title truncate" title={task.title}>
        {task.title}
      </span>
      <span className="overview-task-assignee">
        {task.assigneeId ? <Avatar size="sm" name={name} /> : null}
        <span className="truncate muted">{name}</span>
      </span>
      <time className={cx("overview-task-date", tone)} dateTime={dateValue || undefined}>
        {formatOverviewDate(dateValue)}
      </time>
      {statusBadge ? <Badge tone="neutral">{statusLabel(task.status)}</Badge> : null}
    </div>
  );
}

export function ProjectOverviewTab({ projectId }) {
  const { status, error, project, tasks, members, canEdit } = useStore(
    selectWorkspace(projectId)
  );
  const todayKey = useMemo(() => dateOnlyKey(new Date()), []);
  const overview = useMemo(() => overviewFrom(tasks, todayKey), [tasks, todayKey]);

  if (status === "loading" && tasks.length === 0) return <OverviewSkeleton />;

  if (error && tasks.length === 0) {
    return (
      <section className="overview-tab" aria-label="Project overview">
        <InlineNotice
          tone="error"
          action={
            <Button size="sm" onClick={() => void ensureWorkspace(projectId)}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="overview-tab" aria-label="Project overview">
        <EmptyState
          icon="folder"
          title="You don’t have access"
          description="This project doesn’t exist or isn’t available to your account."
        />
      </section>
    );
  }

  const { metrics, statusDistribution, overdueTasks, recentlyCompletedTasks } = overview;
  const maximum = Math.max(1, ...statusDistribution.map(([, count]) => count));
  const visibleMembers = members.slice(0, MEMBER_LIMIT);
  const hiddenMembers = members.length - visibleMembers.length;
  const healthSupported = project.healthSupported !== false;

  return (
    <section className="overview-tab" aria-label="Project overview">
      <div className="overview-grid">
        <div className="stack-4">
          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">Status</h3>
              <span className="toolbar-spacer" />
              <span className="section-meta">{`${metrics.total} total`}</span>
            </div>
            {statusDistribution.length ? (
              <div className="stack-2">
                {statusDistribution.map(([status_, count]) => (
                  <div className="bar-row" key={status_}>
                    <span className="bar-label muted">{statusLabel(status_)}</span>
                    <span className="progress">
                      <span
                        className={cx("progress-fill", BAR_TONES[status_])}
                        style={{
                          width: `${Math.max(4, Math.round((count / maximum) * 100))}%`,
                        }}
                      />
                    </span>
                    <strong className="bar-value">{count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No task data</p>
            )}
          </div>

          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">Overdue tasks</h3>
              <span className="toolbar-spacer" />
              <span className="section-meta">{overdueTasks.length}</span>
            </div>
            {overdueTasks.length ? (
              <div className="overview-task-list">
                {overdueTasks.map((task) => (
                  <OverviewTaskRow
                    key={task.id}
                    task={task}
                    dateValue={task.dueDate}
                    tone="is-overdue"
                    statusBadge
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No overdue tasks</p>
            )}
          </div>

          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">Recently completed</h3>
              <span className="toolbar-spacer" />
              <span className="section-meta">{recentlyCompletedTasks.length}</span>
            </div>
            {recentlyCompletedTasks.length ? (
              <div className="overview-task-list">
                {recentlyCompletedTasks.map((task) => (
                  <OverviewTaskRow key={task.id} task={task} dateValue={task.completedAt} />
                ))}
              </div>
            ) : (
              <p className="muted">No completed tasks yet</p>
            )}
          </div>
        </div>

        <div className="stack-4">
          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">About</h3>
            </div>
            {project.description ? (
              <p className="overview-description">{project.description}</p>
            ) : (
              <p className="muted">No description</p>
            )}

            <div className="about-row">
              <span className="about-label muted">Health</span>
              {canEdit && healthSupported ? (
                <Select
                  aria-label="Project health"
                  className="overview-health-select"
                  value={project.healthStatus}
                  onChange={(event) => void setProjectHealth(projectId, event.target.value)}
                >
                  {PROJECT_HEALTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone={HEALTH_TONES[project.healthStatus] || "neutral"} dot>
                  {healthLabel(project.healthStatus)}
                </Badge>
              )}
              {!healthSupported ? (
                <small className="field-hint">Read-only until migration 017.</small>
              ) : null}
            </div>

            <div className="about-row">
              <span className="about-label muted">Due date</span>
              <span>{formatOverviewDate(project.dueDate)}</span>
            </div>
            <div className="about-row">
              <span className="about-label muted">Created</span>
              <span>{formatOverviewDate(project.createdAt)}</span>
            </div>
          </div>

          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">Members</h3>
              <span className="toolbar-spacer" />
              <span className="section-meta">{members.length}</span>
            </div>
            {visibleMembers.length ? (
              <div className="stack-2">
                {visibleMembers.map((member) => (
                  <div className="overview-member" key={member.userId}>
                    <Avatar size="sm" name={safeDisplayName(member)} />
                    <span className="truncate">{safeDisplayName(member)}</span>
                    <Badge tone="neutral">{roleLabel(member.role)}</Badge>
                  </div>
                ))}
                {hiddenMembers > 0 ? <p className="muted">{`+${hiddenMembers} more`}</p> : null}
              </div>
            ) : (
              <p className="muted">No members yet</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
