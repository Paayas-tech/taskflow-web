/**
 * Dev preview harness (`/__preview`) — visual QA for every screen without a
 * backend. `src/main.jsx` loads this file only when `import.meta.env.DEV`, so
 * none of `src/dev/*` reaches a production bundle.
 *
 * Pick a screen from the left index (or `?screen=<id>`); `?theme=dark` starts
 * in dark mode. Task actions resolve after 300ms and mutate fixture state, so
 * completing, editing, archiving and creating tasks all work. Screens that need
 * a real service (the project Overview tab) render a note instead.
 */

import { Component, useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import AppShell from "../shell/AppShell";
import Sidebar from "../shell/Sidebar";
import SearchDialog from "../shell/SearchDialog";
import HomePage from "../pages/HomePage";
import MyTasksPage from "../pages/MyTasksPage";
import CalendarPage from "../pages/CalendarPage";
import InboxPage from "../pages/InboxPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectWorkspacePage from "../pages/ProjectWorkspacePage";
import ArchivedTasksPage from "../pages/ArchivedTasksPage";
import SettingsPage from "../SettingsPage";
import { ProjectHeader } from "../project/ProjectHeader";
import ProjectDialog from "../projects/ProjectDialog";
import { TaskComposerDialog, TaskDetailPanel } from "../tasks";
import Login from "../auth/Login";
import Onboarding from "../auth/Onboarding";
import ConfigurationErrorScreen from "../auth/ConfigurationErrorScreen";
import { Button, Icon, IconButton, InlineNotice } from "../ui";
import { projectPath } from "../app/appRoutes";
import { dateOnlyKey, isArchived } from "../domain/taskDomain";
import { weekStartIndex } from "../domain/settingsDomain";
import {
  columns,
  createPreviewState,
  members,
  projects as fixtureProjects,
  stories,
  user,
} from "./fixtures";
import {
  createPreviewInvitationActions,
  createPreviewNotificationActions,
  createPreviewProjectActions,
  createPreviewTaskActions,
  createPreviewWorkspaceLoader,
  delay,
} from "./previewActions";

const PREVIEW_PROJECT = fixtureProjects[0];
const PANEL_TASK_ID = "task-sidebar-bug";

const SCREENS = [
  { id: "home", label: "Home", group: "Pages", path: "/", view: "home" },
  { id: "tasks-list", label: "My Tasks (list)", group: "Pages", path: "/tasks", view: "tasks" },
  { id: "tasks-board", label: "My Tasks (board)", group: "Pages", path: "/tasks", view: "tasks" },
  { id: "calendar", label: "Calendar", group: "Pages", path: "/calendar", view: "calendar" },
  { id: "inbox", label: "Inbox", group: "Pages", path: "/inbox", view: "inbox" },
  { id: "projects", label: "Projects", group: "Pages", path: "/projects", view: "projects" },
  {
    id: "archived",
    label: "Archived tasks",
    group: "Pages",
    path: "/archived-tasks",
    view: "archived",
  },
  { id: "settings", label: "Settings", group: "Pages", path: "/settings", view: "settings" },

  { id: "workspace-overview", label: "Project › Overview", group: "Project", view: "project" },
  { id: "workspace-board", label: "Project › Board", group: "Project", view: "project" },
  { id: "workspace-list", label: "Project › List", group: "Project", view: "project" },
  { id: "workspace-stories", label: "Project › Stories", group: "Project", view: "project" },

  { id: "panel-task", label: "Task panel (task)", group: "Surfaces" },
  { id: "panel-story", label: "Task panel (story)", group: "Surfaces" },
  { id: "panel-readonly", label: "Task panel (read-only)", group: "Surfaces" },
  { id: "composer", label: "Composer", group: "Surfaces" },
  { id: "dialog-project", label: "Project dialog", group: "Surfaces" },

  { id: "empty-home", label: "Home (no data)", group: "Empty states", path: "/", view: "home" },
  {
    id: "empty-tasks",
    label: "My Tasks (no data)",
    group: "Empty states",
    path: "/tasks",
    view: "tasks",
  },
  {
    id: "empty-projects",
    label: "Projects (no data)",
    group: "Empty states",
    path: "/projects",
    view: "projects",
  },

  { id: "login", label: "Login", group: "Auth", chrome: false },
  { id: "onboarding", label: "Onboarding", group: "Auth", chrome: false },
  { id: "config-error", label: "Config error", group: "Auth", chrome: false },
];

const SCREEN_IDS = new Set(SCREENS.map((screen) => screen.id));
const SCREEN_GROUPS = [...new Set(SCREENS.map((screen) => screen.group))];

const readQuery = () => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
};

const initialQuery = readQuery();
const initialScreenId = SCREEN_IDS.has(initialQuery.get("screen"))
  ? initialQuery.get("screen")
  : "home";
const initialTheme = initialQuery.get("theme") === "dark" ? "dark" : "light";
// `?bar=0` hides the preview index so the app renders exactly as it ships.
// Press ` (backtick) to toggle it back at any time.
const initialBarVisible = initialQuery.get("bar") !== "0";

/**
 * `MyTasksPage` reads its List/Board choice from localStorage in a lazy state
 * initialiser, so the preference is written before the page mounts.
 */
const applyScreenPreferences = (screenId) => {
  if (screenId !== "tasks-list" && screenId !== "tasks-board") return;
  try {
    window.localStorage.setItem(
      "taskflow:my-tasks-view",
      screenId === "tasks-board" ? "board" : "list"
    );
  } catch {
    /* the pages fall back to the list view without storage */
  }
};

applyScreenPreferences(initialScreenId);

const PREVIEW_CSS = `
.preview-index {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: 208px;
  padding: 12px 10px 24px;
  overflow-y: auto;
  background: var(--color-surface-2);
  border-right: 1px solid var(--color-border-strong);
}
.preview-index-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 6px 8px;
}
.preview-index-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-3);
}
.preview-index-group {
  padding: 12px 6px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-3);
}
.preview-link {
  display: block;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-2);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.preview-link:hover { background: var(--color-surface-3); color: var(--color-text); }
.preview-link.is-active {
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font-weight: 600;
}
.preview-stage { margin-left: 208px; }
.preview-root.is-bare .preview-stage { margin-left: 0; }
.preview-note { max-width: 620px; }
.preview-note-list { margin: 8px 0 0; padding-left: 18px; list-style: disc; color: var(--color-text-2); }
.preview-error-stack {
  max-height: 260px;
  margin: 12px 0 0;
  overflow: auto;
  font: var(--text-xs) / 1.5 var(--font-mono);
  white-space: pre-wrap;
  color: var(--color-text-2);
}
`;

/** Keeps one broken screen from blanking the whole harness. */
class ScreenErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Preview screen failed to render:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="page">
        <header className="page-header">
          <h1 className="page-title">Screen failed to render</h1>
        </header>
        <div className="page-body is-narrow">
          <InlineNotice tone="error">{String(error?.message || error)}</InlineNotice>
          <pre className="preview-error-stack">{String(error?.stack || "")}</pre>
        </div>
      </section>
    );
  }
}

function PreviewNote({ title, description, points = [] }) {
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
      </header>
      <div className="page-body is-narrow">
        <div className="card preview-note">
          <p>{description}</p>
          {points.length ? (
            <ul className="preview-note-list">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function PreviewApp() {
  const [screenId, setScreenId] = useState(initialScreenId);
  const [theme, setTheme] = useState(initialTheme);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state, setState] = useState(createPreviewState);
  const [panelTaskId, setPanelTaskId] = useState(null);
  const [composerValues, setComposerValues] = useState(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(initialBarVisible);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", screenId);
      if (theme === "dark") url.searchParams.set("theme", "dark");
      else url.searchParams.delete("theme");
      if (barVisible) url.searchParams.delete("bar");
      else url.searchParams.set("bar", "0");
      window.history.replaceState({}, "", url);
    } catch {
      /* the harness still works without history support */
    }
  }, [barVisible, screenId, theme]);

  useEffect(() => {
    const toggleBar = (event) => {
      if (event.key !== "`" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      event.preventDefault();
      setBarVisible((current) => !current);
    };
    window.addEventListener("keydown", toggleBar);
    return () => window.removeEventListener("keydown", toggleBar);
  }, []);

  const taskActions = useMemo(() => createPreviewTaskActions(state, setState), [state]);
  const notificationActions = useMemo(() => createPreviewNotificationActions(setState), []);
  const invitationActions = useMemo(() => createPreviewInvitationActions(setState), []);
  const projectActions = useMemo(() => createPreviewProjectActions(setState), []);
  const workspaceLoader = useMemo(
    () => createPreviewWorkspaceLoader(() => stateRef.current),
    []
  );

  const screen = SCREENS.find((item) => item.id === screenId) || SCREENS[0];
  const todayKey = dateOnlyKey(new Date());
  const activeTasks = state.tasks.filter((task) => !isArchived(task));
  const archivedTasks = state.tasks.filter((task) => isArchived(task));
  const editableProjects = state.projects.filter((project) =>
    ["owner", "editor"].includes(project.viewerRole)
  );
  const unreadCount = state.notifications.filter((item) => !item.readAt).length;
  const formatSettings = state.settings.time;

  const searchItems = [
    ...state.projects.map((project) => ({
      id: `project:${project.id}`,
      type: "project",
      title: project.name,
      subtitle: project.description || "Project",
      project,
    })),
    ...activeTasks.map((task) => ({
      id: `task:${task.id}`,
      type: "task",
      title: task.title,
      subtitle: task.projectName || "Personal task",
      task,
    })),
    ...state.projectTasks
      .filter((task) => task.workType === "story")
      .map((task) => ({
        id: `story:${task.id}`,
        type: "story",
        title: task.title,
        subtitle: task.projectName || "Story",
        task,
      })),
  ];

  const selectScreen = (nextId) => {
    if (!SCREEN_IDS.has(nextId)) return;
    applyScreenPreferences(nextId);
    setPanelTaskId(null);
    setComposerValues(null);
    setProjectDialogOpen(false);
    setSearchOpen(false);
    setMobileOpen(false);
    setScreenId(nextId);
  };

  const selectSearchItem = (item) => {
    setSearchOpen(false);
    if (item.type === "project") return selectScreen("workspace-board");
    if (item.task?.projectId) return selectScreen("workspace-board");
    return setPanelTaskId(item.task?.id || null);
  };

  const navigate = (path) => {
    if (path === "/") return selectScreen("home");
    if (path === "/tasks") return selectScreen("tasks-list");
    if (path === "/calendar") return selectScreen("calendar");
    if (path === "/inbox") return selectScreen("inbox");
    if (path === "/projects") return selectScreen("projects");
    if (path === "/settings") return selectScreen("settings");
    if (path === "/archived-tasks") return selectScreen("archived");
    if (String(path).startsWith("/projects/")) {
      const tab = String(path).split("/")[3] || "overview";
      return selectScreen(SCREEN_IDS.has(`workspace-${tab}`) ? `workspace-${tab}` : "workspace-overview");
    }
    return undefined;
  };

  const openComposer = (initialValues) => {
    setComposerValues(initialValues && !initialValues.nativeEvent ? initialValues : {});
  };

  const openTask = (task) => {
    if (task?.id) setPanelTaskId(task.id);
  };

  const saveSettings = async (nextSettings) => {
    await delay();
    setState((current) => ({ ...current, settings: nextSettings }));
  };

  const submitComposer = async (values) => {
    const created = values.projectId
      ? await taskActions.createInProject(values.projectId, values)
      : await taskActions.createPersonal(values);
    setComposerValues(null);
    return created;
  };

  const panelTask =
    [...state.tasks, ...state.projectTasks].find((task) => task.id === panelTaskId) || null;

  const renderPanel = (task, { readOnly = false } = {}) => {
    if (!task) return null;
    const project = state.projects.find((item) => item.id === task.projectId) || null;
    const relatedTasks =
      task.workType === "story"
        ? state.projectTasks.filter((item) => item.storyId === task.id)
        : [];

    return (
      <TaskDetailPanel
        key={`${task.id}:${readOnly}`}
        task={task}
        /* userId stays null so the panel skips the comment/activity/attachment
           tabs, which would call Supabase from the harness. */
        userId={null}
        project={project}
        projectMembers={task.projectId ? members : []}
        projectStories={task.projectId ? stories : []}
        projectColumns={task.projectId ? columns : []}
        projects={editableProjects}
        readOnly={readOnly}
        onUpdate={(patch) => taskActions.update(task, patch)}
        onToggleComplete={() => taskActions.toggleComplete(task)}
        onArchive={() => taskActions.archive(task)}
        onRestore={() => taskActions.restore(task)}
        onDelete={() => taskActions.remove(task)}
        onSetAssignee={(assigneeId) => taskActions.setAssignee(task, assigneeId)}
        onClose={() => (panelTaskId ? setPanelTaskId(null) : selectScreen("tasks-list"))}
        relatedTasks={relatedTasks}
        onOpenRelatedTask={(related) => setPanelTaskId(related.id)}
        onCreateRelatedTask={(title) =>
          taskActions.createInProject(task.projectId, { title, storyId: task.id })
        }
        todayKey={todayKey}
        defaultReminderMinutes={state.settings.reminder.defaultTime}
      />
    );
  };

  const renderHome = (empty = false) => (
    <HomePage
      userId={user.uid}
      displayName={user.displayName}
      now={new Date()}
      tasks={empty ? [] : activeTasks}
      projects={empty ? [] : state.projects}
      invitations={empty ? [] : state.invitations}
      onAcceptInvitation={invitationActions.accept}
      onDeclineInvitation={invitationActions.decline}
      notifications={empty ? [] : state.notifications}
      taskActions={taskActions}
      onOpenTask={openTask}
      selectedTaskId={panelTaskId}
      onNewTask={openComposer}
      onNewProject={() => setProjectDialogOpen(true)}
      onNavigate={navigate}
      formatSettings={formatSettings}
    />
  );

  const renderMyTasks = (empty = false) => (
    <MyTasksPage
      userId={user.uid}
      tasks={empty ? [] : activeTasks}
      projects={empty ? [] : state.projects}
      taskActions={taskActions}
      onOpenTask={openTask}
      selectedTaskId={panelTaskId}
      onNewTask={openComposer}
      formatSettings={formatSettings}
      weekStartsOn={weekStartIndex(formatSettings.weekStartsOn)}
    />
  );

  const renderProjects = (empty = false) => (
    <ProjectsPage
      userId={user.uid}
      projects={empty ? [] : state.projects}
      onCreateProject={projectActions.create}
      onUpdateProject={projectActions.update}
      onDeleteProject={projectActions.remove}
      onOpenProject={() => selectScreen("workspace-board")}
      invitations={empty ? [] : state.invitations}
      onAcceptInvitation={invitationActions.accept}
      onDeclineInvitation={invitationActions.decline}
    />
  );

  const renderWorkspace = (tab) => (
    <ProjectWorkspacePage
      userId={user.uid}
      projectId={PREVIEW_PROJECT.id}
      project={PREVIEW_PROJECT}
      projects={state.projects}
      tab={tab}
      onTabChange={(next) => selectScreen(`workspace-${next}`)}
      onProjectTasksChanged={() => {}}
      onUpdateProject={projectActions.update}
      onDeleteProject={projectActions.remove}
      onBack={() => selectScreen("projects")}
      formatSettings={formatSettings}
      defaultReminderMinutes={state.settings.reminder.defaultTime}
      workspaceLoader={workspaceLoader}
    />
  );

  const renderScreen = () => {
    switch (screen.id) {
      case "tasks-list":
      case "tasks-board":
        return renderMyTasks();
      case "calendar":
        return (
          <CalendarPage
            userId={user.uid}
            tasks={activeTasks}
            externalEvents={[]}
            taskActions={taskActions}
            onOpenTask={openTask}
            selectedTaskId={panelTaskId}
            onNewTask={openComposer}
            formatSettings={formatSettings}
            weekStartsOn={weekStartIndex(formatSettings.weekStartsOn)}
            projects={state.projects}
          />
        );
      case "inbox":
        return (
          <InboxPage
            notifications={state.notifications}
            onMarkRead={notificationActions.markRead}
            onMarkAllRead={notificationActions.markAllRead}
            onDismiss={notificationActions.dismiss}
            onRefresh={notificationActions.refresh}
            onNavigate={navigate}
            onOpenSettings={() => selectScreen("settings")}
          />
        );
      case "projects":
        return renderProjects();
      case "archived":
        return (
          <ArchivedTasksPage
            tasks={archivedTasks}
            taskActions={taskActions}
            onOpenTask={openTask}
            onBack={() => selectScreen("settings")}
            projects={state.projects}
          />
        );
      case "settings":
        return (
          <SettingsPage
            settings={state.settings}
            loading={false}
            error=""
            saving={false}
            saveMessage=""
            onChange={(next) => setState((current) => ({ ...current, settings: next }))}
            onSave={saveSettings}
            onCommit={saveSettings}
            onSignOut={() => delay()}
            onDeleteAccount={() => delay()}
            onNavigate={navigate}
            onOpenProjectCreate={() => setProjectDialogOpen(true)}
            onRestoreProject={() => delay()}
            exportData={{ version: 1, settings: state.settings, tasks: state.tasks }}
            onGoogleEventsChange={() => {}}
          />
        );
      case "workspace-overview":
        return (
          <div className="page workspace">
            <ProjectHeader
              userId={user.uid}
              project={PREVIEW_PROJECT}
              members={members}
              stories={stories}
              tab="overview"
              onTabChange={(next) => selectScreen(`workspace-${next}`)}
              canEdit
              onNewTask={() => openComposer({ projectId: PREVIEW_PROJECT.id })}
              onNewStory={() => openComposer({ projectId: PREVIEW_PROJECT.id })}
              onUpdateProject={projectActions.update}
              onDeleteProject={projectActions.remove}
              onBack={() => selectScreen("projects")}
            />
            <div className="page-body workspace-content is-narrow">
              <InlineNotice tone="info">
                Overview tab requires backend. `ProjectOverviewTab` loads its stats through
                `projectOverviewService.load(userId, projectId)` and takes no injected data, so
                the harness cannot render it offline. The other three tabs are live.
              </InlineNotice>
            </div>
          </div>
        );
      case "workspace-board":
        return renderWorkspace("board");
      case "workspace-list":
        return renderWorkspace("list");
      case "workspace-stories":
        return renderWorkspace("stories");
      case "panel-task":
      case "panel-story":
      case "panel-readonly": {
        const task =
          screen.id === "panel-story"
            ? state.projectTasks.find((item) => item.workType === "story")
            : state.projectTasks.find((item) => item.id === PANEL_TASK_ID);
        return (
          <>
            <PreviewNote
              title={screen.label}
              description="The detail panel is open on the right. Every property saves after 300ms."
              points={[
                "Edit the title, description, status, priority, due date, assignee or story.",
                "Comments, activity and attachments are hidden here: they need Supabase.",
                "Esc or the close button returns to My Tasks.",
              ]}
            />
            {renderPanel(task, { readOnly: screen.id === "panel-readonly" })}
          </>
        );
      }
      case "composer":
        return (
          <>
            <PreviewNote
              title="Composer"
              description="`TaskComposerDialog` with the fixture projects, members and stories."
              points={[
                "Type a title, pick a project chip, then Create task (⌘/Ctrl+Enter).",
                "Created tasks are appended to the fixture state and show up in My Tasks.",
              ]}
            />
            <TaskComposerDialog
              open
              onClose={() => selectScreen("tasks-list")}
              onSubmit={submitComposer}
              userId={user.uid}
              projects={editableProjects}
              projectContext={{ members, stories }}
              defaultReminderMinutes={state.settings.reminder.defaultTime}
            />
          </>
        );
      case "dialog-project":
        return (
          <>
            <PreviewNote
              title="Project dialog"
              description="`ProjectDialog` in create mode: name, description and the eight-colour palette."
            />
            <ProjectDialog
              open
              onClose={() => selectScreen("projects")}
              onSubmit={async (values) => {
                await projectActions.create(values);
                selectScreen("projects");
              }}
            />
          </>
        );
      case "empty-home":
        return renderHome(true);
      case "empty-tasks":
        return renderMyTasks(true);
      case "empty-projects":
        return renderProjects(true);
      case "login":
        return <Login onSignInSuccess={() => {}} onRecoverPassword={() => {}} />;
      case "onboarding":
        return (
          <Onboarding
            displayName={user.displayName}
            saving={false}
            onComplete={() => {}}
            onStartOver={() => {}}
          />
        );
      case "config-error":
        return <ConfigurationErrorScreen onRetry={() => {}} />;
      default:
        return renderHome();
    }
  };

  const body = (
    <ScreenErrorBoundary key={screen.id}>
      {renderScreen()}
      {panelTaskId && !screen.id.startsWith("panel-") ? renderPanel(panelTask) : null}
      {composerValues && screen.id !== "composer" ? (
        <TaskComposerDialog
          open
          onClose={() => setComposerValues(null)}
          onSubmit={submitComposer}
          initialValues={composerValues}
          userId={user.uid}
          projects={editableProjects}
          projectContext={{ members, stories }}
          defaultReminderMinutes={state.settings.reminder.defaultTime}
        />
      ) : null}
      {projectDialogOpen && screen.id !== "dialog-project" ? (
        <ProjectDialog
          open
          onClose={() => setProjectDialogOpen(false)}
          onSubmit={async (values) => {
            await projectActions.create(values);
            setProjectDialogOpen(false);
          }}
        />
      ) : null}
    </ScreenErrorBoundary>
  );

  return (
    <div className={`preview-root${barVisible ? "" : " is-bare"}`}>
      <style>{PREVIEW_CSS}</style>

      {barVisible ? <nav className="preview-index" aria-label="Preview screens">
        <div className="preview-index-head">
          <span className="preview-index-title">Preview</span>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name={theme === "dark" ? "sun" : "moon"} />}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <IconButton
            size="sm"
            label="Hide preview index (press ` to show it again)"
            onClick={() => setBarVisible(false)}
          >
            <Icon name="panel-left" />
          </IconButton>
        </div>

        {SCREEN_GROUPS.map((group) => (
          <div key={group}>
            <p className="preview-index-group">{group}</p>
            {SCREENS.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`preview-link${item.id === screen.id ? " is-active" : ""}`}
                aria-current={item.id === screen.id ? "page" : undefined}
                onClick={() => selectScreen(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav> : null}

      <div className="preview-stage">
        {screen.chrome === false ? (
          body
        ) : (
          <AppShell
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            sidebar={
              <Sidebar
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed((current) => !current)}
                currentPath={
                  screen.view === "project"
                    ? projectPath(PREVIEW_PROJECT.id, screen.id.replace("workspace-", ""))
                    : screen.path || "/"
                }
                currentView={screen.view || "home"}
                projects={state.projects}
                selectedProjectId={screen.view === "project" ? PREVIEW_PROJECT.id : null}
                unreadCount={unreadCount}
                invitationCount={state.invitations.length}
                onNavigate={navigate}
                onNewTask={() => openComposer({})}
                onNewProject={() => setProjectDialogOpen(true)}
                onOpenSearch={() => setSearchOpen(true)}
                user={{ displayName: user.displayName, email: user.email }}
                onOpenProfile={() => selectScreen("settings")}
                onOpenSettings={() => selectScreen("settings")}
                onSignOut={() => delay()}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
              />
            }
          >
            <IconButton
              className="menu-toggle app-menu-toggle"
              label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="list" />
            </IconButton>
            {body}
          </AppShell>
        )}

        <SearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          items={searchItems}
          onSelect={selectSearchItem}
        />
      </div>
    </div>
  );
}
