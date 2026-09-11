/**
 * The four Home widgets and the card shell they share. Every widget reads what
 * it shows from the store and calls store actions directly, so the page renders
 * them without props.
 */
import { useMemo, useState } from "react";
import { notificationTypeLabel } from "../domain/collaboration";
import { dateOnlyKey, isTaskComplete } from "../domain/task";
import { readProjectTab } from "../lib/preferences";
import {
  selectActiveProjects,
  selectErrors,
  selectLoaded,
  selectMyTasks,
  selectNotifications,
  selectProfiles,
  selectSelectedTaskId,
  selectSettings,
} from "../store/selectors";
import { loadProjects, loadTasks } from "../store/session";
import { useStore } from "../store/store";
import { createTask } from "../store/tasks";
import { navigate, openComposer, openProjectCreate, setProjectTab } from "../store/ui";
import { QuickAdd } from "../tasks/QuickAdd";
import { TaskRow } from "../tasks/TaskRow";
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  SegmentedControl,
} from "../ui";
import { cx } from "../ui/primitives";
import {
  effectiveMyDayDate,
  homeTaskBuckets,
  latestNotifications,
  notificationText,
  recentProjects,
} from "./homeData";

const TASK_LIMIT = 6;
const PROJECT_LIMIT = 6;
const NOTIFICATION_LIMIT = 5;

/** The day these widgets treat as today, honouring the My day reset time. */
const useTodayKey = () => {
  const settings = useStore(selectSettings);
  return useMemo(
    () => dateOnlyKey(effectiveMyDayDate(new Date(), settings.myDay)),
    [settings.myDay]
  );
};

/** Opens a project on the tab it was last left on. */
const openProject = (projectId) => setProjectTab(projectId, readProjectTab(projectId));

/* -------------------------------------------------------------------------
 * Shell
 * ---------------------------------------------------------------------- */

/** Card shell shared by the four Home widgets. */
function Widget({ title, actions, footer, children, className, ...rest }) {
  return (
    <section className={cx("widget", className)} aria-label={title} {...rest}>
      <header className="widget-header">
        <h2 className="widget-title">{title}</h2>
        {actions ? <div className="widget-actions">{actions}</div> : null}
      </header>
      <div className="widget-body">{children}</div>
      {footer ? <div className="widget-footer">{footer}</div> : null}
    </section>
  );
}

/** Placeholder rows shown while a widget's slice is loading its first data. */
function WidgetSkeleton({ rows = 3, label = "Loading" }) {
  return (
    <div className="widget-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} aria-hidden="true">
          <span className="skeleton widget-skeleton-mark" />
          <span className="skeleton widget-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

/** A failed load inside a widget, with the retry that reloads its slice. */
function WidgetError({ message, onRetry }) {
  return (
    <InlineNotice
      tone="error"
      className="widget-notice"
      action={
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </InlineNotice>
  );
}

/* -------------------------------------------------------------------------
 * My tasks
 * ---------------------------------------------------------------------- */

const taskTabs = [
  { id: "today", label: "Today", empty: "Nothing due today" },
  { id: "upcoming", label: "Upcoming", empty: "Nothing due in the next 7 days" },
  { id: "overdue", label: "Overdue", empty: "Nothing overdue" },
];

/** Today / Upcoming / Overdue tasks with an inline quick-add underneath. */
export function MyTasksWidget() {
  const tasks = useStore(selectMyTasks);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const selectedTaskId = useStore(selectSelectedTaskId);
  const [tab, setTab] = useState("today");

  const todayKey = useTodayKey();
  const buckets = useMemo(() => homeTaskBuckets(tasks, todayKey), [tasks, todayKey]);

  const activeTab = taskTabs.find((item) => item.id === tab) ?? taskTabs[0];
  const visible = buckets[activeTab.id].slice(0, TASK_LIMIT);
  const dueDate = activeTab.id === "today" ? todayKey : "";
  const loading = loaded.tasks === "loading" && tasks.length === 0;
  const error = errors.tasks;

  return (
    <Widget
      className="my-tasks-widget"
      title="My tasks"
      actions={
        <>
          <SegmentedControl
            size="sm"
            ariaLabel="Filter my tasks"
            value={activeTab.id}
            onChange={setTab}
            options={taskTabs.map((item) => ({
              id: item.id,
              label: item.label,
              count: buckets[item.id].length,
            }))}
          />
          <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
            View all
          </Button>
        </>
      }
      footer={
        <QuickAdd
          autoFocus={false}
          onCreate={(title) => createTask({ title, dueDate })}
          onOpenDetails={(title) => openComposer({ title, dueDate })}
        />
      }
    >
      {loading ? <WidgetSkeleton label="Loading tasks" /> : null}
      {!loading && error ? (
        <WidgetError message={error} onRetry={() => void loadTasks()} />
      ) : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState icon="check-square" title={activeTab.empty} />
      ) : null}
      {!loading && !error
        ? visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dense
              showProject
              todayKey={todayKey}
              selected={task.id === selectedTaskId}
            />
          ))
        : null}
    </Widget>
  );
}

/* -------------------------------------------------------------------------
 * Assigned to me
 * ---------------------------------------------------------------------- */

/** Open project tasks assigned to the signed-in person. */
export function AssignedWidget() {
  const tasks = useStore(selectMyTasks);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const selectedTaskId = useStore(selectSelectedTaskId);

  const todayKey = useTodayKey();
  // selectMyTasks already orders the assigned project tasks by attention.
  const visible = useMemo(
    () =>
      tasks
        .filter((task) => task.projectId && !isTaskComplete(task))
        .slice(0, TASK_LIMIT),
    [tasks]
  );
  const loading = loaded.tasks === "loading" && tasks.length === 0;
  const error = errors.tasks;

  return (
    <Widget
      className="assigned-widget"
      title="Assigned to me"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
          View all
        </Button>
      }
    >
      {loading ? <WidgetSkeleton label="Loading assigned tasks" /> : null}
      {!loading && error ? (
        <WidgetError message={error} onRetry={() => void loadTasks()} />
      ) : null}
      {!loading && !error && visible.length === 0 ? (
        <p className="widget-empty muted">No project tasks are assigned to you.</p>
      ) : null}
      {!loading && !error
        ? visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dense
              showProject
              todayKey={todayKey}
              selected={task.id === selectedTaskId}
            />
          ))
        : null}
    </Widget>
  );
}

/* -------------------------------------------------------------------------
 * Projects
 * ---------------------------------------------------------------------- */

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

/** Active projects, most recently updated first, opening on their last tab. */
export function ProjectsWidget() {
  const projects = useStore(selectActiveProjects);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);

  const visible = useMemo(() => recentProjects(projects, PROJECT_LIMIT), [projects]);
  const loading = loaded.projects === "loading" && projects.length === 0;
  const error = errors.projects;

  return (
    <Widget
      className="projects-widget"
      title="Projects"
      actions={
        <>
          <IconButton label="New project" size="sm" onClick={() => openProjectCreate()}>
            <Icon name="plus" />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
            View all
          </Button>
        </>
      }
    >
      {loading ? <WidgetSkeleton label="Loading projects" /> : null}
      {!loading && error ? (
        <WidgetError message={error} onRetry={() => void loadProjects()} />
      ) : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState
          icon="folders"
          title="No projects yet"
          description="Create one to group work and invite people."
          action={
            <Button variant="secondary" size="sm" onClick={() => openProjectCreate()}>
              Create a project
            </Button>
          }
        />
      ) : null}
      {!loading && !error
        ? visible.map((project) => (
            <button
              key={project.id}
              type="button"
              className="widget-row home-project-row"
              onClick={() => openProject(project.id)}
            >
              <span
                className="home-project-row-color"
                style={{ backgroundColor: project.color || "var(--color-accent)" }}
                aria-hidden="true"
              />
              <span className="home-project-row-name truncate">{project.name}</span>
              {roleLabels[project.viewerRole] ? (
                <span className="home-project-row-meta muted">
                  {roleLabels[project.viewerRole]}
                </span>
              ) : null}
            </button>
          ))
        : null}
    </Widget>
  );
}

/* -------------------------------------------------------------------------
 * Inbox
 * ---------------------------------------------------------------------- */

const formatNotificationTime = (value, timeFormat) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat !== "24-hour",
  }).format(date);
};

/** The five newest notifications, unread first-class, linking into the project. */
export function InboxWidget() {
  const notifications = useStore(selectNotifications);
  const profiles = useStore(selectProfiles);
  const loaded = useStore(selectLoaded);
  const settings = useStore(selectSettings);

  const visible = useMemo(
    () => latestNotifications(notifications, NOTIFICATION_LIMIT),
    [notifications]
  );
  const loading = loaded.notifications === "loading" && notifications.length === 0;

  return (
    <Widget
      className="inbox-widget"
      title="Inbox"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/inbox")}>
          Open inbox
        </Button>
      }
    >
      {loading ? <WidgetSkeleton label="Loading notifications" rows={2} /> : null}
      {!loading && visible.length === 0 ? (
        <p className="widget-empty muted">You're all caught up.</p>
      ) : null}
      {!loading
        ? visible.map((notification) => {
            const unread = !notification.readAt;
            return (
              <button
                key={notification.id}
                type="button"
                className={cx("widget-row", "inbox-row", unread && "is-unread")}
                onClick={() =>
                  notification.projectId
                    ? openProject(notification.projectId)
                    : navigate("/inbox")
                }
              >
                <span className="inbox-row-dot" aria-hidden="true" />
                <span className="inbox-row-main">
                  <span className="inbox-row-text truncate">
                    {notificationText(notification, profiles)}
                  </span>
                  <span className="inbox-row-meta muted">
                    {notificationTypeLabel(notification.type)} ·{" "}
                    {formatNotificationTime(notification.createdAt, settings.time.format)}
                  </span>
                </span>
                {unread ? <span className="sr-only">Unread</span> : null}
              </button>
            );
          })
        : null}
    </Widget>
  );
}
