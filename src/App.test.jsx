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

vi.mock("react", () => ({
  default: {},
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

vi.mock("./ArchivedTasksPage", () => ({ default: () => null }));
vi.mock("./CalendarPage", () => ({ default: () => null }));
vi.mock("./ConfigurationErrorScreen", () => ({ default: () => null }));
vi.mock("./Dashboard", () => ({ default: () => null }));
vi.mock("./Login", () => ({ default: () => null }));
vi.mock("./NotificationsPanel", () => ({ default: () => null }));
vi.mock("./ProjectsPage", () => ({ default: () => null }));
vi.mock("./ProjectTasksPage", () => ({ default: () => null }));
vi.mock("./Recover", () => ({ default: () => null }));
vi.mock("./SettingsPage", () => ({ default: () => null }));
vi.mock("./TasksPage", () => ({ default: () => null }));
vi.mock("./TodayPage", () => ({ default: () => null }));

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
  onAuthStateChange: vi.fn((callback) => {
    callback("SIGNED_IN", { uid: "user-a", email: "test-user" });
    return vi.fn();
  }),
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
  getProjects: vi.fn().mockResolvedValue([]),
  getUserInvitations: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn(),
}));
vi.mock("./application/settingsService", () => ({
  getSettings: vi.fn(() => new Promise(() => {})),
  saveSettings: vi.fn(),
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
  return {
    ...createEventTarget(),
    location: { pathname: "/" },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    matchMedia: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
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
    (node) => node.type === "button" && textContent(node) === "+ New Task"
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
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.getComputedStyle;
  vi.restoreAllMocks();
});

describe("App create-task modal lifecycle integration", () => {
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
    expect(textContent(description)).toContain("Add the details now");
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
