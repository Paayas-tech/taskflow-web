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
  getTasks: vi.fn().mockResolvedValue([]),
}));

const authService = vi.hoisted(() => ({
  callback: null,
  onAuthStateChange: vi.fn((callback) => {
    authService.callback = callback;
    callback("SIGNED_IN", { uid: "user-a", email: "test-user" });
    return vi.fn();
  }),
}));

const projectService = vi.hoisted(() => ({
  getProjects: vi.fn().mockResolvedValue([]),
}));

const componentCaptures = vi.hoisted(() => ({
  projectsPageProps: null,
  projectTasksPageProps: null,
  tasksPageProps: null,
}));

vi.mock("react", () => ({
  default: {},
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

vi.mock("./ArchivedTasksPage", () => ({ default: () => null }));
vi.mock("./CalendarPage", () => ({ default: () => null }));
vi.mock("./ConfigurationErrorScreen", () => ({ default: () => null }));
vi.mock("./Dashboard", () => ({
  default: () => null,
}));
vi.mock("./Login", () => ({ default: () => null }));
vi.mock("./InboxPage", () => ({ default: () => null }));
vi.mock("./NotificationsPanel", () => ({ default: () => null }));
vi.mock("./ProjectsPage", () => ({
  default: (props) => {
    componentCaptures.projectsPageProps = props;
    return null;
  },
}));
vi.mock("./ProjectTasksPage", () => ({
  default: (props) => {
    componentCaptures.projectTasksPageProps = props;
    return null;
  },
}));
vi.mock("./Recover", () => ({ default: () => null }));
vi.mock("./SettingsPage", () => ({ default: () => null }));
vi.mock("./application/googleCalendarIntegrationService", () => ({
  googleCalendarIntegrationService: {
    getConnection: vi.fn().mockResolvedValue(null),
    sync: vi.fn().mockResolvedValue({ events: [] }),
  },
}));
vi.mock("./TasksPage", () => ({
  default: (props) => {
    componentCaptures.tasksPageProps = props;
    return {
      type: "button",
      key: null,
      props: {
        ref: props.createTaskTriggerRef,
        type: "button",
        onClick: () => props.onCreateScheduledTask({}),
        children: "+ Add task",
      },
    };
  },
}));

vi.mock("./TaskForm", () => ({
  default: ({ values, onChange, onSubmit, onCancel, busy, error }) => ({
    type: "form",
    key: null,
    props: {
      className: "test-task-form",
      onSubmit,
      children: [
        {
          type: "input",
          key: null,
          props: {
            name: "title",
            value: values.title,
            onChange,
            disabled: busy,
          },
        },
        {
          type: "button",
          key: null,
          props: { type: "submit", disabled: busy, children: "Create Task" },
        },
        {
          type: "button",
          key: null,
          props: {
            type: "button",
            disabled: busy,
            onClick: onCancel,
            children: "Cancel",
          },
        },
        error
          ? {
              type: "p",
              key: null,
              props: { role: "alert", children: error },
            }
          : null,
      ],
    },
  }),
}));

vi.mock("./application/authService", () => ({
  onAuthStateChange: authService.onAuthStateChange,
  signOut: vi.fn(),
}));
vi.mock("./application/signOutController", () => ({
  createSignOutController: () => ({ reset: vi.fn(), run: vi.fn() }),
}));
vi.mock("./application/taskService", () => ({
  getTasks: taskService.getTasks,
  createTask: taskService.createTask,
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  archiveTask: vi.fn(),
  unarchiveTask: vi.fn(),
}));
vi.mock("./application/listService", () => ({
  getLists: vi.fn().mockResolvedValue([]),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}));
vi.mock("./application/projectService", () => ({
  createProject: vi.fn(),
  createProjectTask: vi.fn(),
  acceptProjectInvitation: vi.fn(),
  declineProjectInvitation: vi.fn(),
  deleteProject: vi.fn(),
  getAssignedProjectTasks: vi.fn().mockResolvedValue([]),
  getProjects: projectService.getProjects,
  getUserInvitations: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn(),
}));
vi.mock("./application/settingsService", () => ({
  getSettings: vi.fn(() => new Promise(() => {})),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./services/reminderService", () => ({
  createReminderScheduler: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    check: vi.fn(),
  }),
}));
vi.mock("./infrastructure/supabase/client", () => ({
  isSupabaseConfigured: true,
}));

import App from "./App";

const mountedRunners = new Set();

function childrenOf(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
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

function walk(node, visitor) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visitor));
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  childrenOf(node).forEach((child) => walk(child, visitor));
}

function findElement(root, predicate) {
  let match;
  walk(root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function createDom(node) {
  if (Array.isArray(node)) return node.map(createDom);
  if (!node || typeof node !== "object") return null;
  const descendants = [];
  const tabIndex =
    node.props?.tabIndex ??
    (["button", "input", "select", "textarea", "a"].includes(node.type) ? 0 : -1);
  const element = {
    node,
    descendants,
    disabled: Boolean(node.props?.disabled),
    hidden: Boolean(node.props?.hidden),
    isConnected: true,
    tabIndex,
    focus: vi.fn(() => {
      document.activeElement = element;
    }),
    getAttribute(name) {
      if (name === "tabindex" && node.props?.tabIndex !== undefined) {
        return String(tabIndex);
      }
      if (name === "aria-hidden") return node.props?.["aria-hidden"] ?? null;
      return null;
    },
    closest: () => null,
    contains(candidate) {
      return candidate === element || descendants.some((child) => child.contains(candidate));
    },
    querySelectorAll() {
      const result = [];
      const collect = (candidate) => {
        if (!candidate.disabled && candidate.tabIndex >= 0) result.push(candidate);
        candidate.descendants.forEach(collect);
      };
      descendants.forEach(collect);
      return result;
    },
  };

  for (const child of childrenOf(node)) {
    const childDom = createDom(child);
    if (Array.isArray(childDom)) descendants.push(...childDom.filter(Boolean));
    else if (childDom) descendants.push(childDom);
  }
  if (node.props?.ref && typeof node.props.ref === "object") {
    node.props.ref.current = element;
  }
  return element;
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
    activeElement: null,
    body: { style: { overflow: "" } },
    documentElement: { dataset: {}, style: {} },
  };
}

function createWindow() {
  const storage = new Map();
  return {
    ...createEventTarget(),
    location: { pathname: "/" },
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
    createDom(runner.output);

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

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

function openTaskDialog(runner) {
  const trigger = findElement(
    runner.output,
    (node) => node.type === "button" && textContent(node) === "+ Add task"
  );
  trigger.props.onClick();
  runner.render();
  return {
    trigger,
    dialog: findElement(runner.output, (node) => node.props?.id === "create-task-dialog"),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.window = createWindow();
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  taskService.createTask.mockReset().mockResolvedValue({ id: "task-1" });
  taskService.getTasks.mockClear();
  projectService.getProjects.mockReset().mockResolvedValue([]);
  componentCaptures.projectsPageProps = null;
  componentCaptures.projectTasksPageProps = null;
  componentCaptures.tasksPageProps = null;
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.getComputedStyle;
  vi.restoreAllMocks();
});

describe("App create-task modal lifecycle integration", () => {
  it("provides the shared global navigation controls and reuses existing flows", async () => {
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", description: "Release workspace", viewerRole: "owner" },
    ]);
    const runner = createRunner();
    await Promise.resolve();
    await Promise.resolve();
    runner.render();

    const shell = findElement(runner.output, (node) => node.props?.className === "app-shell");
    const sidebarToggle = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Collapse sidebar"
    );
    expect(textContent(runner.output)).toContain("TaskFlow");
    expect(findElement(runner.output, (node) => node.props?.["aria-label"] === "Search TaskFlow")).toBeDefined();
    expect(findElement(runner.output, (node) => node.props?.["aria-label"] === "Help")).toBeDefined();
    expect(findElement(runner.output, (node) => node.props?.["aria-label"] === "Settings")).toBeUndefined();
    expect(findElement(runner.output, (node) => node.props?.["aria-label"] === "Account menu")).toBeDefined();

    sidebarToggle.props.onClick();
    runner.render();
    expect(shell.props.className).toBe("app-shell");
    expect(findElement(runner.output, (node) => node.props?.className === "app-shell sidebar-collapsed")).toBeDefined();

    findElement(runner.output, (node) => node.type === "button" && textContent(node) === "+ Create").props.onClick();
    runner.render();
    expect(textContent(runner.output)).toContain("Create a personal task");
    expect(textContent(runner.output)).toContain("Create a collaborative workspace");
    expect(textContent(runner.output)).not.toContain("+ New Task");

    const search = findElement(runner.output, (node) => node.props?.["aria-label"] === "Search TaskFlow");
    search.props.onChange({ target: { value: "Launch" } });
    runner.render();
    expect(textContent(runner.output)).toContain("Release workspace");

    findElement(runner.output, (node) => node.props?.["aria-label"] === "Account menu").props.onClick();
    runner.render();
    expect(textContent(runner.output)).toContain("test-user");
    expect(textContent(runner.output)).toContain("Profile");
    expect(textContent(runner.output)).toContain("Settings");
    expect(textContent(runner.output)).toContain("Sign out");

    findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Profile"
    ).props.onClick();
    runner.render();
    expect(findElement(
      runner.output,
      (node) => node.props?.role === "dialog" && node.props?.["aria-label"] === "TaskFlow settings"
    )).toBeDefined();
    findElement(runner.output, (node) => node.props?.["aria-label"] === "Close settings").props.onClick();
    runner.render();

    findElement(runner.output, (node) => node.props?.["aria-label"] === "Account menu").props.onClick();
    runner.render();

    findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Settings"
    ).props.onClick();
    runner.render();
    expect(findElement(
      runner.output,
      (node) => node.props?.role === "dialog" && node.props?.["aria-label"] === "TaskFlow settings"
    )).toBeDefined();
    expect(findElement(runner.output, (node) => node.props?.["aria-label"] === "Close settings")).toBeDefined();
  });

  it("renders the simplified sidebar with an independently collapsible accessible project list", async () => {
    projectService.getProjects.mockResolvedValue([
      { id: "project-a", name: "Launch", color: "#6757c8", status: "active", viewerRole: "owner" },
      { id: "project-b", name: "Shared roadmap", status: "active", viewerRole: "viewer" },
      { id: "project-c", name: "Archived work", status: "archived", archivedAt: "2026-08-01", viewerRole: "owner" },
    ]);
    const runner = createRunner();
    await Promise.resolve();
    await Promise.resolve();
    runner.render();

    const primaryNavigation = findElement(
      runner.output,
      (node) => node.type === "nav" && node.props?.["aria-label"] === "Primary navigation"
    );
    const navigationText = textContent(primaryNavigation);
    for (const label of ["Dashboard", "Tasks", "Projects", "Calendar", "Reminders"]) {
      expect(navigationText).toContain(label);
    }
    for (const hiddenLabel of ["Planning", "Timeline", "Board", "Lists", "Goals", "Issues", "Starred", "For you", "Recent", "Project pages", "Settings"]) {
      expect(navigationText).not.toContain(hiddenLabel);
    }
    expect(navigationText).toContain("Launch");
    expect(navigationText).toContain("Shared roadmap");
    expect(navigationText).not.toContain("Archived work");

    const launchProject = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Launch"
    );
    launchProject.props.onClick();
    runner.render();
    expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/projects/project-a");
    expect(findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Launch"
    ).props["aria-current"]).toBe("page");

    const disclosure = findElement(
      runner.output,
      (node) => node.type === "button" && node.props?.["aria-controls"] === "sidebar-project-list"
    );
    expect(disclosure.props["aria-expanded"]).toBe(true);
    disclosure.props.onClick();
    runner.render();
    expect(window.localStorage.setItem).toHaveBeenCalledWith("taskflow:sidebar-projects-expanded", "false");
    expect(findElement(runner.output, (node) => node.props?.id === "sidebar-project-list")).toBeUndefined();

    const projectsLink = findElement(
      runner.output,
      (node) => node.type === "button" && node.props?.["aria-label"] === "Projects"
    );
    projectsLink.props.onClick();
    runner.render();
    expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/projects");
  });

  it("exposes inline personal-task creation without opening the full task form", async () => {
    window.location.pathname = "/tasks";
    const runner = createRunner();
    await Promise.resolve();
    await Promise.resolve();
    runner.render();

    await componentCaptures.tasksPageProps.onInlineCreateTask("Review launch");

    expect(taskService.createTask).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ title: "Review launch", status: "todo", projectId: null })
    );
    expect(findElement(runner.output, (node) => node.props?.id === "create-task-dialog")).toBeUndefined();
  });

  it("keeps project creation out of the global topbar for contextual placement", async () => {
    window.location.pathname = "/projects";
    const runner = createRunner();
    await Promise.resolve();
    await Promise.resolve();
    runner.render();

    expect(
      findElement(
        runner.output,
        (node) => node.type === "button" && textContent(node) === "+ New Project"
      )
    ).toBeUndefined();
    expect(textContent(runner.output)).not.toContain("Plan meaningful work");
    expect(textContent(runner.output)).not.toContain("+ New Task");
    expect(componentCaptures.projectsPageProps.createTriggerRef).toBeDefined();
  });

  it("passes every accessible project to ProjectsPage and preserves viewer direct access", async () => {
    const projects = [
      { id: "owned-project", ownerId: "user-a", viewerRole: "owner" },
      { id: "editor-project", ownerId: "user-b", viewerRole: "editor" },
      { id: "viewer-project", ownerId: "user-c", viewerRole: "viewer" },
    ];
    projectService.getProjects.mockResolvedValue(projects);
    window.location.pathname = "/projects/viewer-project";

    const runner = createRunner();
    await Promise.resolve();
    await Promise.resolve();
    runner.render();

    expect(componentCaptures.projectsPageProps.projects).toEqual(projects);
    expect(componentCaptures.projectTasksPageProps.project).toEqual(projects[2]);
    expect(componentCaptures.projectTasksPageProps.projectId).toBe("viewer-project");
    expect(
      findElement(runner.output, (node) => node.props?.className === "topbar")
    ).toBeUndefined();
    expect(textContent(runner.output)).not.toContain("+ New Task");
  });

  it("does not reload data for an equivalent same-user token refresh", () => {
    const runner = createRunner();
    expect(taskService.getTasks).toHaveBeenCalledOnce();

    authService.callback("TOKEN_REFRESHED", {
      uid: "user-a",
      email: "test-user",
      displayName: undefined,
    });
    runner.render();

    expect(taskService.getTasks).toHaveBeenCalledOnce();
    expect(textContent(runner.output)).not.toContain("Loading...");
  });

  it("preserves dialog semantics, initial focus, and body scroll locking", () => {
    document.body.style.overflow = "clip";
    const runner = createRunner();
    const { dialog } = openTaskDialog(runner);
    const close = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Close Create Task dialog"
    );
    const title = findElement(
      runner.output,
      (node) => node.props?.id === dialog.props["aria-labelledby"]
    );
    const description = findElement(
      runner.output,
      (node) => node.props?.id === dialog.props["aria-describedby"]
    );

    expect(dialog.props.role).toBe("dialog");
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(textContent(title)).toBe("Create Task");
    expect(textContent(description)).toContain("Add task details.");
    expect(dialog.props.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(close.props.ref.current);
    expect(document.body.style.overflow).toBe("hidden");

    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("preserves Escape, backdrop, content, and explicit close behavior", () => {
    const runner = createRunner();
    openTaskDialog(runner);
    document.dispatch("keydown", keyEvent("Escape"));
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();

    openTaskDialog(runner);
    let backdrop = findElement(
      runner.output,
      (node) => node.props?.className === "task-modal-backdrop"
    );
    backdrop.props.onMouseDown({ target: {}, currentTarget: {} });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();

    backdrop = findElement(runner.output, (node) => node.props?.className === "task-modal-backdrop");
    const sameTarget = {};
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();

    openTaskDialog(runner);
    const close = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Close Create Task dialog"
    );
    close.props.onClick();
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("contains Tab focus and ignores modal keys while closed", () => {
    const runner = createRunner();
    const outside = {};
    document.activeElement = outside;
    const closedTab = keyEvent("Tab");
    document.dispatch("keydown", keyEvent("Escape"));
    document.dispatch("keydown", closedTab);
    expect(document.activeElement).toBe(outside);
    expect(closedTab.preventDefault).not.toHaveBeenCalled();

    const { dialog } = openTaskDialog(runner);
    const focusable = dialog.props.ref.current.querySelectorAll();
    const first = focusable[0];
    const last = focusable.at(-1);

    document.activeElement = last;
    const tab = keyEvent("Tab");
    document.dispatch("keydown", tab);
    expect(tab.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(first);

    document.activeElement = first;
    const shiftTab = keyEvent("Tab", true);
    document.dispatch("keydown", shiftTab);
    expect(shiftTab.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(last);
  });

  it("blocks dismissal and duplicate submission while task creation is pending", async () => {
    const creation = deferred();
    taskService.createTask.mockReturnValueOnce(creation.promise);
    const runner = createRunner();
    const { trigger } = openTaskDialog(runner);
    const title = findElement(
      runner.output,
      (node) => node.type === "input" && node.props?.name === "title"
    );
    title.props.onChange({ target: { name: "title", value: "Phase 3 task", type: "text" } });
    runner.render();
    const form = findElement(runner.output, (node) => node.props?.className === "test-task-form");
    const submission = form.props.onSubmit({ preventDefault: vi.fn() });
    form.props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    const dialog = findElement(runner.output, (node) => node.props?.role === "dialog");
    const backdrop = findElement(
      runner.output,
      (node) => node.props?.className === "task-modal-backdrop"
    );
    const close = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Close Create Task dialog"
    );
    const sameTarget = {};
    document.dispatch("keydown", keyEvent("Escape"));
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    close.props.onClick();
    runner.render();

    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();
    expect(dialog.props["aria-busy"]).toBe(true);
    expect(taskService.createTask).toHaveBeenCalledOnce();

    creation.resolve({ id: "task-1" });
    await submission;
    runner.render();

    expect(taskService.createTask).toHaveBeenCalledWith("user-a", {
      title: "Phase 3 task",
      description: "",
      notes: "",
      status: "todo",
      completed: false,
      priority: "medium",
      dueDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      reminder: false,
      reminderAt: "",
      listId: null,
      projectId: null,
    });
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
    expect(textContent(document.activeElement.node)).toBe(textContent(trigger));
  });

  it("keeps the dialog open with the existing error after creation fails", async () => {
    taskService.createTask.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const runner = createRunner();
    openTaskDialog(runner);
    const title = findElement(
      runner.output,
      (node) => node.type === "input" && node.props?.name === "title"
    );
    title.props.onChange({ target: { name: "title", value: "Retry task", type: "text" } });
    runner.render();
    const form = findElement(runner.output, (node) => node.props?.className === "test-task-form");

    await form.props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();
    expect(textContent(findElement(runner.output, (node) => node.props?.role === "alert"))).toBe(
      "We couldn't create this task. Check your connection and try again."
    );
  });
});
