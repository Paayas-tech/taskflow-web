import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  const same = (left, right) =>
    Boolean(
      left &&
        right &&
        left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]))
    );

  return {
    activate(runner) {
      activeRunner = runner;
    },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        },
      ];
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.callback;
      }
      activeRunner.slots[index] = { callback, dependencies };
      return callback;
    },
    useMemo(factory, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.value;
      }
      const value = factory();
      activeRunner.slots[index] = { value, dependencies };
      return value;
    },
    useEffect(effect, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (!previous || !same(previous.dependencies, dependencies)) {
        activeRunner.pending.push({ index, effect, dependencies });
      }
    },
  };
});

const taskService = vi.hoisted(() => ({
  createTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  archiveTask: vi.fn(),
  unarchiveTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const projectService = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getAssignedProjectTasks: vi.fn(),
  getUserInvitations: vi.fn(),
  createProject: vi.fn(),
  createProjectTask: vi.fn(),
  updateProjectTask: vi.fn(),
  archiveProjectTask: vi.fn(),
  deleteProjectTask: vi.fn(),
  setTaskAssignee: vi.fn(),
}));

const settingsService = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

const authService = vi.hoisted(() => ({
  callback: null,
  onAuthStateChange: vi.fn((callback) => {
    authService.callback = callback;
    callback("SIGNED_IN", { uid: "user-a", email: "test-user@example.com" });
    return vi.fn();
  }),
}));

const notificationsState = vi.hoisted(() => ({
  value: {
    notifications: [],
    loading: false,
    error: "",
    liveNotice: "",
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    refresh: vi.fn(),
  },
}));

const captures = vi.hoisted(() => ({}));

vi.mock("react", () => ({
  default: {},
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

const captureOnly = vi.hoisted(() => (name) => (props) => {
  captures[name] = props;
  return null;
});

vi.mock("./shell/AppShell", () => ({
  default: (props) => {
    captures.appShell = props;
    return {
      type: "div",
      key: null,
      props: { className: "app-shell", children: [props.sidebar, props.children] },
    };
  },
}));
vi.mock("./shell/Sidebar", () => ({ default: captureOnly("sidebar") }));
vi.mock("./shell/SearchDialog", () => ({ default: captureOnly("searchDialog") }));
vi.mock("./inbox/useNotifications", () => ({
  default: (userId) => {
    captures.notificationsUserId = userId;
    return notificationsState.value;
  },
}));
vi.mock("./pages/HomePage", () => ({ default: captureOnly("home") }));
vi.mock("./pages/MyTasksPage", () => ({ default: captureOnly("myTasks") }));
vi.mock("./pages/CalendarPage", () => ({ default: captureOnly("calendar") }));
vi.mock("./pages/InboxPage", () => ({ default: captureOnly("inbox") }));
vi.mock("./pages/ProjectsPage", () => ({ default: captureOnly("projects") }));
vi.mock("./pages/ProjectWorkspacePage", () => ({ default: captureOnly("workspace") }));
vi.mock("./pages/ArchivedTasksPage", () => ({ default: captureOnly("archived") }));
vi.mock("./SettingsPage", () => ({ default: captureOnly("settings") }));
vi.mock("./auth/ConfigurationErrorScreen", () => ({ default: () => null }));
vi.mock("./auth/Login", () => ({ default: captureOnly("login") }));
vi.mock("./auth/Onboarding", () => ({ default: captureOnly("onboarding") }));
vi.mock("./auth/Recover", () => ({ default: captureOnly("recover") }));
vi.mock("./collaboration/ProfileCompletionPrompt", () => ({
  default: captureOnly("profilePrompt"),
}));
vi.mock("./tasks/ConnectedTaskDetailPanel", () => ({ default: captureOnly("panel") }));
vi.mock("./tasks/TaskComposerDialog", () => ({ default: captureOnly("composer") }));

vi.mock("./application/authService", () => ({
  onAuthStateChange: authService.onAuthStateChange,
  signOut: vi.fn(),
  completeOnboarding: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("./application/signOutController", () => ({
  createSignOutController: () => ({ reset: vi.fn(), run: vi.fn() }),
}));
vi.mock("./application/googleCalendarIntegrationService", () => ({
  googleCalendarIntegrationService: {
    getConnection: vi.fn().mockResolvedValue(null),
    sync: vi.fn().mockResolvedValue({ events: [] }),
  },
}));
vi.mock("./application/attachmentService", () => ({
  attachmentService: { removeAll: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("./application/taskService", () => taskService);
vi.mock("./application/projectService", () => ({
  ...projectService,
  acceptProjectInvitation: vi.fn(),
  declineProjectInvitation: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("./application/settingsService", () => settingsService);
vi.mock("./services/reminderService", () => ({
  createReminderScheduler: () => ({ start: vi.fn(), stop: vi.fn(), check: vi.fn() }),
}));
vi.mock("./infrastructure/supabase/client", () => ({ isSupabaseConfigured: true }));

import App from "./App";
import { normalizeSettings } from "./domain/settingsDomain";

const mountedRunners = new Set();

function childrenOf(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children.flat(Infinity) : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
}

function resolveNode(node) {
  if (Array.isArray(node)) return node.map(resolveNode);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return resolveNode(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: childrenOf(node).map(resolveNode) },
  };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? new Set();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

function createDocument() {
  return {
    ...createEventTarget(),
    title: "",
    activeElement: null,
    body: { style: { overflow: "" } },
    documentElement: { dataset: {}, style: {} },
    querySelector: () => null,
  };
}

function createWindow(pathname = "/") {
  const storage = new Map();
  return {
    ...createEventTarget(),
    location: { pathname, reload: vi.fn() },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    matchMedia: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    localStorage: {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => storage.set(key, String(value))),
    },
    scrollTo: vi.fn(),
  };
}

function createRunner() {
  const runner = { cursor: 0, pending: [], slots: [], output: null };

  function render() {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = resolveNode(App());

    for (const pending of runner.pending) {
      runner.slots[pending.index]?.cleanup?.();
      runner.slots[pending.index] = {
        dependencies: pending.dependencies,
        cleanup: pending.effect(),
      };
    }
    return runner.output;
  }

  function unmount() {
    for (const slot of [...runner.slots].reverse()) slot?.cleanup?.();
    runner.slots = [];
    mountedRunners.delete(api);
  }

  const api = {
    render,
    unmount,
    get output() {
      return runner.output;
    },
  };
  mountedRunners.add(api);
  render();
  render();
  return api;
}

async function flush(runner, times = 3) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
  runner.render();
}

async function mountApp() {
  const runner = createRunner();
  await flush(runner);
  await flush(runner);
  return runner;
}

const personalTask = (overrides = {}) => ({
  id: "task-1",
  title: "Write the brief",
  status: "todo",
  completed: false,
  priority: "medium",
  dueDate: "",
  projectId: null,
  archivedAt: null,
  ...overrides,
});

const assignedTask = (overrides = {}) => ({
  id: "project-task-1",
  title: "Ship the release",
  status: "todo",
  completed: false,
  priority: "medium",
  dueDate: "",
  projectId: "project-a",
  projectName: "Launch",
  assigneeId: "user-a",
  archivedAt: null,
  ...overrides,
});

beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.window = createWindow();
  taskService.getTasks.mockReset().mockResolvedValue([]);
  taskService.createTask.mockReset().mockResolvedValue({ id: "created-task" });
  taskService.updateTask.mockReset().mockResolvedValue(undefined);
  taskService.archiveTask.mockReset().mockResolvedValue(undefined);
  taskService.unarchiveTask.mockReset().mockResolvedValue(undefined);
  taskService.deleteTask.mockReset().mockResolvedValue(undefined);
  projectService.getProjects.mockReset().mockResolvedValue([]);
  projectService.getAssignedProjectTasks.mockReset().mockResolvedValue([]);
  projectService.getUserInvitations.mockReset().mockResolvedValue([]);
  projectService.createProject.mockReset().mockResolvedValue({ id: "project-new" });
  projectService.createProjectTask
    .mockReset()
    .mockResolvedValue({ id: "created-project-task" });
  projectService.updateProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.archiveProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.deleteProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.setTaskAssignee.mockReset().mockResolvedValue(undefined);
  settingsService.getSettings.mockReset().mockResolvedValue(normalizeSettings());
  settingsService.saveSettings
    .mockReset()
    .mockResolvedValue({ settings: normalizeSettings(), profileUpdated: true });
  notificationsState.value = {
    notifications: [],
    loading: false,
    error: "",
    liveNotice: "",
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    refresh: vi.fn(),
  };
  for (const key of Object.keys(captures)) delete captures[key];
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe("App shell routing", () => {
  it("renders Home by default and titles the document", async () => {
    await mountApp();

    expect(captures.home).toBeDefined();
    expect(captures.myTasks).toBeUndefined();
    expect(captures.sidebar.currentPath).toBe("/");
    expect(captures.sidebar.currentView).toBe("home");
    expect(document.title).toBe("Home · TaskFlow");
  });

  it("normalizes a bare project path to its overview tab", async () => {
    globalThis.window = createWindow("/projects/project-a");
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", status: "active", viewerRole: "owner" },
    ]);

    await mountApp();

    expect(window.history.replaceState).toHaveBeenCalledWith(
      {},
      "",
      "/projects/project-a/overview"
    );
    expect(captures.workspace.projectId).toBe("project-a");
    expect(captures.workspace.tab).toBe("overview");
    expect(captures.workspace.project).toEqual(
      expect.objectContaining({ name: "Launch" })
    );
    expect(document.title).toBe("Launch · TaskFlow");
  });

  it("remembers the project tab and navigates to it", async () => {
    globalThis.window = createWindow("/projects/project-a/board");
    const runner = await mountApp();

    expect(captures.workspace.tab).toBe("board");

    captures.workspace.onTabChange("list");
    runner.render();

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "taskflow:project-tab:project-a",
      "list"
    );
    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      "",
      "/projects/project-a/list"
    );
  });

  it("applies the saved default view on the first load", async () => {
    settingsService.getSettings.mockResolvedValue(
      normalizeSettings({ navigation: { defaultView: "tasks" } })
    );

    await mountApp();

    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/tasks");
    expect(captures.myTasks).toBeDefined();
  });

  it("does not reload data for an equivalent same-user token refresh", async () => {
    const runner = await mountApp();
    expect(taskService.getTasks).toHaveBeenCalledOnce();

    authService.callback("TOKEN_REFRESHED", {
      uid: "user-a",
      email: "test-user@example.com",
      displayName: undefined,
    });
    runner.render();

    expect(taskService.getTasks).toHaveBeenCalledOnce();
  });

  it("resets loaded data when a different user signs in", async () => {
    taskService.getTasks.mockResolvedValue([personalTask()]);
    const runner = await mountApp();
    expect(captures.home.tasks).toHaveLength(1);

    authService.callback("SIGNED_IN", { uid: "user-b", email: "other@example.com" });
    runner.render();

    expect(captures.home.tasks).toEqual([]);
    expect(taskService.getTasks).toHaveBeenCalledTimes(2);
  });
});

describe("App shell chrome", () => {
  it("passes unread and invitation counts to the sidebar", async () => {
    notificationsState.value = { ...notificationsState.value, unreadCount: 4 };
    projectService.getUserInvitations.mockResolvedValue([
      { id: "invitation-a" },
      { id: "invitation-b" },
    ]);

    await mountApp();

    expect(captures.notificationsUserId).toBe("user-a");
    expect(captures.sidebar.unreadCount).toBe(4);
    expect(captures.sidebar.invitationCount).toBe(2);
  });

  it("opens search with the keyboard and navigates to a chosen project", async () => {
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", status: "active", viewerRole: "owner" },
    ]);
    const runner = await mountApp();

    expect(captures.searchDialog.open).toBe(false);

    const preventDefault = vi.fn();
    window.dispatch("keydown", { key: "k", metaKey: true, preventDefault });
    runner.render();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(captures.searchDialog.open).toBe(true);

    const projectResult = captures.searchDialog.items.find(
      (item) => item.type === "project"
    );
    expect(projectResult).toEqual(
      expect.objectContaining({ title: "Launch", type: "project" })
    );

    captures.searchDialog.onSelect(projectResult);
    runner.render();

    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      "",
      "/projects/project-a/overview"
    );
  });

  it("opens the projects page with a create request from the sidebar", async () => {
    const runner = await mountApp();

    captures.sidebar.onNewProject();
    runner.render();

    expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/projects");
    expect(captures.projects.createRequest).toBe(1);
  });
});

describe("App task data", () => {
  it("merges personal and assigned tasks without duplicates or stories", async () => {
    taskService.getTasks.mockResolvedValue([
      personalTask(),
      personalTask({ id: "archived-task", archivedAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    projectService.getAssignedProjectTasks.mockResolvedValue([
      assignedTask(),
      assignedTask({ id: "story-1", workType: "story", title: "Release story" }),
      assignedTask({ id: "task-1", title: "Duplicate" }),
      assignedTask({ id: "archived-project-task", archivedAt: "2026-08-02T00:00:00.000Z" }),
    ]);

    await mountApp();

    expect(captures.home.tasks.map((task) => task.id)).toEqual([
      "task-1",
      "project-task-1",
    ]);
    expect(captures.home.tasks[0].title).toBe("Write the brief");
  });

  it("dispatches taskActions.update to the personal or the project service", async () => {
    taskService.getTasks.mockResolvedValue([personalTask()]);
    projectService.getAssignedProjectTasks.mockResolvedValue([assignedTask()]);
    const runner = await mountApp();

    const [personal, project] = captures.home.tasks;

    await captures.home.taskActions.update(personal, { priority: "high" });
    expect(taskService.updateTask).toHaveBeenCalledWith("user-a", "task-1", {
      priority: "high",
    });
    expect(projectService.updateProjectTask).not.toHaveBeenCalled();

    await captures.home.taskActions.update(project, { priority: "low" });
    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "project-task-1",
      { priority: "low" }
    );
    await flush(runner);
    expect(projectService.getAssignedProjectTasks).toHaveBeenCalledTimes(2);
  });

  it("optimistically completes an assigned project task", async () => {
    projectService.getAssignedProjectTasks.mockResolvedValue([assignedTask()]);
    const runner = await mountApp();

    const pending = captures.home.taskActions.toggleComplete(captures.home.tasks[0]);
    runner.render();

    expect(captures.home.tasks[0].completed).toBe(true);
    expect(captures.home.taskActions.pendingIds.has("project-task-1")).toBe(true);

    await pending;
    runner.render();

    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "project-task-1",
      expect.objectContaining({ completed: true, status: "completed" })
    );
    expect(captures.home.taskActions.pendingIds.has("project-task-1")).toBe(false);
  });

  it("creates a personal task or a project task from the composer", async () => {
    const runner = await mountApp();

    captures.sidebar.onNewTask();
    runner.render();
    expect(captures.composer.open).toBe(true);

    await captures.composer.onSubmit({ title: "Personal work" });
    expect(taskService.createTask).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({
        title: "Personal work",
        status: "todo",
        projectId: null,
      })
    );

    await captures.composer.onSubmit({
      title: "Project work",
      projectId: "project-a",
      assigneeId: "member-a",
    });
    expect(projectService.createProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      expect.objectContaining({ title: "Project work", projectId: "project-a" })
    );
    expect(projectService.setTaskAssignee).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "created-project-task",
      "member-a"
    );
  });
});

describe("App go to project", () => {
  it("closes the panel, asks the workspace for the task and navigates there", async () => {
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", status: "active", viewerRole: "owner" },
    ]);
    projectService.getAssignedProjectTasks.mockResolvedValue([assignedTask()]);
    window.localStorage.setItem("taskflow:project-tab:project-a", "list");
    const runner = await mountApp();

    const projectTask = captures.home.tasks[0];
    captures.home.onOpenTask(projectTask);
    runner.render();
    expect(captures.panel.task.id).toBe("project-task-1");
    expect(captures.panel.onOpenProject).toBe(captures.home.onOpenProject);

    captures.panel.onOpenProject(projectTask);
    runner.render();

    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      "",
      "/projects/project-a/list"
    );
    expect(captures.workspace.openItemRequest).toEqual(
      expect.objectContaining({ projectId: "project-a", itemId: "project-task-1" })
    );
    expect(captures.workspace.projectId).toBe("project-a");
  });

  it("gives every task list a handler and ignores a personal task", async () => {
    taskService.getTasks.mockResolvedValue([personalTask()]);
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", status: "active", viewerRole: "owner" },
    ]);
    const runner = await mountApp();

    captures.home.onOpenProject(captures.home.tasks[0]);
    runner.render();
    expect(window.history.pushState).not.toHaveBeenCalled();

    for (const [path, capture] of [
      ["/tasks", "myTasks"],
      ["/calendar", "calendar"],
      ["/archived-tasks", "archived"],
    ]) {
      captures.sidebar.onNavigate(path);
      runner.render();

      captures[capture].onOpenProject({ id: "project-task-1", projectId: "project-a" });
      runner.render();
      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/projects/project-a/overview"
      );
    }
  });
});

describe("App task detail panel host", () => {
  it("opens the panel for the selected task and closes it when the task disappears", async () => {
    taskService.getTasks.mockResolvedValue([personalTask()]);
    const runner = await mountApp();

    expect(captures.panel).toBeUndefined();

    captures.home.onOpenTask(captures.home.tasks[0]);
    runner.render();

    expect(captures.panel).toEqual(
      expect.objectContaining({ userId: "user-a" })
    );
    expect(captures.panel.task.id).toBe("task-1");
    expect(captures.home.selectedTaskId).toBe("task-1");

    captures.panel = undefined;
    taskService.getTasks.mockResolvedValue([]);
    captures.home.onRetryTasks();
    await flush(runner);
    runner.render();

    expect(captures.panel).toBeUndefined();
    expect(captures.home.selectedTaskId).toBeNull();
  });
});
