import { useCallback, useEffect, useState } from "react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Select } from "../ui/Field";
import { InlineNotice } from "../ui/InlineNotice";
import { cx } from "../ui/cx";
import { safeDisplayName } from "../domain/identityDomain";
import {
  formatOverviewDate,
  PROJECT_HEALTH_OPTIONS,
  statusLabel,
} from "../domain/projectOverviewDomain";
import { projectOverviewService } from "../application/projectOverviewService";

const MEMBER_LIMIT = 8;

const HEALTH_TONES = {
  on_track: "success",
  at_risk: "warning",
  off_track: "danger",
  on_hold: "neutral",
  complete: "info",
};

const STATUS_ORDER = ["todo", "in_progress", "in-progress", "done", "completed"];

const BAR_TONES = {
  todo: "is-todo",
  in_progress: "is-progress",
  "in-progress": "is-progress",
  done: "is-done",
  completed: "is-done",
};

const ROLE_LABELS = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const roleLabel = (role) => ROLE_LABELS[role] || "Member";

const healthLabel = (value) =>
  PROJECT_HEALTH_OPTIONS.find((option) => option.value === value)?.label || "On track";

const orderedDistribution = (distribution = {}) =>
  Object.entries(distribution).sort(
    ([first], [second]) =>
      (STATUS_ORDER.indexOf(first) + 1 || STATUS_ORDER.length + 1) -
      (STATUS_ORDER.indexOf(second) + 1 || STATUS_ORDER.length + 1)
  );

const assigneeName = (task) =>
  task.assigneeId ? task.assigneeName || "TaskFlow user" : "Unassigned";

function OverviewSkeleton() {
  return (
    <section
      className="overview-tab is-loading"
      role="status"
      aria-label="Loading project overview"
    >
      <div className="overview-stats">
        {[0, 1, 2, 3].map((index) => (
          <div className="stat" key={index}>
            <span className="skeleton overview-skeleton-value" />
            <span className="skeleton overview-skeleton-line" />
          </div>
        ))}
      </div>
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

function OverviewTaskRow({ task, dateValue, tone, statusBadge = false, onOpenTask }) {
  const open = () => onOpenTask?.(task.id);
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

/**
 * Project overview tab: headline metrics, status distribution, overdue and
 * recently completed work, project details and members.
 */
export function ProjectOverviewTab({
  userId,
  projectId,
  project = null,
  onOpenTask,
  members = [],
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthError, setHealthError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await projectOverviewService.load(userId, projectId));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateHealth = async (healthStatus) => {
    const previous = data?.project?.healthStatus;
    const patchHealth = (value) => (current) =>
      current ? { ...current, project: { ...current.project, healthStatus: value } } : current;

    setData(patchHealth(healthStatus));
    setSavingHealth(true);
    setHealthError("");
    try {
      await projectOverviewService.updateHealth(projectId, healthStatus);
    } catch (updateError) {
      setData(patchHealth(previous));
      setHealthError(updateError.message);
    } finally {
      setSavingHealth(false);
    }
  };

  if (loading) return <OverviewSkeleton />;

  if (error) {
    return (
      <section className="overview-tab" aria-label="Project overview">
        <InlineNotice
          tone="error"
          action={
            <Button size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      </section>
    );
  }

  if (!data) {
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

  const { metrics, statusDistribution, overdueTasks, recentlyCompletedTasks } = data;
  const record = { ...(project || {}), ...data.project };
  const canEditHealth =
    record.healthSupported !== false && ["owner", "editor"].includes(record.viewerRole);
  const distribution = orderedDistribution(statusDistribution);
  const maximum = Math.max(1, ...distribution.map(([, count]) => count));
  const visibleMembers = members.slice(0, MEMBER_LIMIT);
  const hiddenMembers = members.length - visibleMembers.length;

  const stats = [
    { id: "total", label: "Total", value: metrics.total },
    { id: "completed", label: "Completed", value: metrics.completed },
    { id: "in-progress", label: "In progress", value: metrics.inProgress },
    { id: "overdue", label: "Overdue", value: metrics.overdue, danger: metrics.overdue > 0 },
  ];

  return (
    <section className="overview-tab" aria-label="Project overview">
      {healthError ? (
        <InlineNotice tone="error" onDismiss={() => setHealthError("")}>
          {healthError}
        </InlineNotice>
      ) : null}

      <div className="overview-stats">
        {stats.map((stat) => (
          <div className={cx("stat", stat.danger && "is-danger")} key={stat.id}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="overview-grid">
        <div className="stack-4">
          <div className="card stack-3">
            <div className="section-header">
              <h3 className="section-title">Status</h3>
              <span className="toolbar-spacer" />
              <span className="section-meta">{`${metrics.total} total`}</span>
            </div>
            {distribution.length ? (
              <div className="stack-2">
                {distribution.map(([status, count]) => (
                  <div className="bar-row" key={status}>
                    <span className="bar-label muted">{statusLabel(status)}</span>
                    <span className="progress">
                      <span
                        className={cx("progress-fill", BAR_TONES[status])}
                        style={{ width: `${Math.max(4, Math.round((count / maximum) * 100))}%` }}
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
                    onOpenTask={onOpenTask}
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
                  <OverviewTaskRow
                    key={task.id}
                    task={task}
                    dateValue={task.completedAt}
                    onOpenTask={onOpenTask}
                  />
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
            {record.description ? (
              <p className="overview-description">{record.description}</p>
            ) : (
              <p className="muted">No description</p>
            )}

            <div className="about-row">
              <span className="about-label muted">Health</span>
              {canEditHealth ? (
                <Select
                  aria-label="Project health"
                  className="overview-health-select"
                  value={record.healthStatus}
                  disabled={savingHealth}
                  onChange={(event) => void updateHealth(event.target.value)}
                >
                  {PROJECT_HEALTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone={HEALTH_TONES[record.healthStatus] || "neutral"} dot>
                  {healthLabel(record.healthStatus)}
                </Badge>
              )}
            </div>
            {record.healthSupported === false ? (
              <p className="muted overview-health-note">
                Health editing is unavailable until migration 017 is applied.
              </p>
            ) : null}

            <div className="about-row">
              <span className="about-label muted">Due date</span>
              <span>{formatOverviewDate(record.dueDate)}</span>
            </div>
            <div className="about-row">
              <span className="about-label muted">Created</span>
              <span>{formatOverviewDate(record.createdAt)}</span>
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
                {hiddenMembers > 0 ? (
                  <p className="muted">{`+${hiddenMembers} more`}</p>
                ) : null}
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

export default ProjectOverviewTab;
