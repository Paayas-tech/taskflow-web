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
    useId() {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { value: "task-edit-test" };
      return activeRunner.slots[index].value;
    },
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) return previous.callback;
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

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useId: hookRuntime.useId,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

vi.mock("./TaskForm", () => ({
  default: ({ values, onChange, onSubmit, onCancel, busy, error }) => (
    <form aria-label="Task form" onSubmit={onSubmit}>
      <input
        aria-label="Title"
        name="title"
        value={values.title}
        onChange={onChange}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>Save changes</button>
      <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
    </form>
  ),
}));
vi.mock("./ActivityFeed", () => ({ default: () => null }));
vi.mock("./TaskAssigneeSelector", () => ({ default: () => null }));
vi.mock("./TaskComments", () => ({ default: () => null }));

import TaskEditModal from "./TaskEditModal";

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
    props: {
      ...node.props,
      children: childrenOf(node).map(resolveNode),
    },
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
  const tabIndex = node.props?.tabIndex ??
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
      if (name === "tabindex" && node.props?.tabIndex !== undefined) return String(tabIndex);
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
    querySelector() {
      return element.querySelectorAll()[0] ?? null;
    },
  };
  for (const child of childrenOf(node)) {
    const childDom = createDom(child);
    if (Array.isArray(childDom)) descendants.push(...childDom.filter(Boolean));
    else if (childDom) descendants.push(childDom);
  }
  if (node.props?.ref && typeof node.props.ref === "object") node.props.ref.current = element;
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

function createRunner(props) {
  const runner = { cursor: 0, pending: [], slots: [], output: null, dom: null };
  function render(nextProps = props) {
    props = nextProps;
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = resolveNode(TaskEditModal(props));
    runner.dom = createDom(runner.output);
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
    get output() { return runner.output; },
  };
  mountedRunners.add(api);
  render();
  return api;
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

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

function baseProps(overrides = {}) {
  return {
    task: {
      id: "task-1",
      title: "Original task",
      description: "Description",
      notes: "Notes",
      status: "todo",
      priority: "medium",
      dueDate: "",
      reminder: false,
      listId: "list-1",
      projectId: "project-1",
    },
    lists: [{ id: "list-1", name: "Tasks" }],
    projects: [{ id: "project-1", name: "Project" }],
    projectsLoading: false,
    projectsError: "",
    onRetryProjects: vi.fn(),
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn().mockResolvedValue(undefined),
    onArchiveTask: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  const documentTarget = createEventTarget();
  globalThis.document = {
    ...documentTarget,
    activeElement: null,
    body: { style: { overflow: "" } },
  };
  const windowTarget = createEventTarget();
  globalThis.window = {
    ...windowTarget,
    scrollX: 14,
    scrollY: 28,
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
    cancelAnimationFrame: vi.fn(),
    scrollTo: vi.fn(),
  };
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.getComputedStyle;
  vi.restoreAllMocks();
});

describe("TaskEditModal lifecycle integration", () => {
  it("preserves dialog semantics, initial focus, and body scroll locking", () => {
    document.body.style.overflow = "clip";
    const runner = createRunner(baseProps());
    const dialog = findElement(runner.output, (node) => node.props?.role === "dialog");
    const title = findElement(runner.output, (node) => node.props?.id === dialog.props["aria-labelledby"]);
    const description = findElement(runner.output, (node) => node.props?.id === dialog.props["aria-describedby"]);

    expect(dialog.props["aria-modal"]).toBe("true");
    expect(textContent(title)).toBe("Edit Task");
    expect(textContent(description)).toContain("Update this task");
    expect(textContent(document.activeElement?.node)).toBe("Archive task");
    expect(document.body.style.overflow).toBe("hidden");

    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("preserves Escape, backdrop, content, explicit close, and cleanup focus behavior", () => {
    const returnFocusElement = { isConnected: true, disabled: false, tabIndex: 0, focus: vi.fn(), getAttribute: () => null, closest: () => null };
    const props = baseProps({ returnFocusElement });
    const escapeRunner = createRunner(props);
    document.dispatch("keydown", keyEvent("Escape"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    escapeRunner.unmount();
    expect(window.scrollTo).toHaveBeenCalledWith(14, 28);
    expect(returnFocusElement.focus).toHaveBeenCalledWith({ preventScroll: true });

    const backdropProps = baseProps();
    const backdropRunner = createRunner(backdropProps);
    const backdrop = findElement(backdropRunner.output, (node) => node.props?.className?.includes("task-modal-backdrop"));
    backdrop.props.onMouseDown({ target: {}, currentTarget: {} });
    expect(backdropProps.onClose).not.toHaveBeenCalled();
    const sameTarget = {};
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    expect(backdropProps.onClose).toHaveBeenCalledTimes(1);

    const close = findElement(backdropRunner.output, (node) => node.props?.["aria-label"] === "Close Edit Task dialog");
    close.props.onClick();
    expect(backdropProps.onClose).toHaveBeenCalledTimes(2);
  });

  it("traps Tab and Shift+Tab within the outer dialog", () => {
    const runner = createRunner(baseProps());
    const dialog = findElement(runner.output, (node) => node.props?.role === "dialog");
    const dialogDom = dialog.props.ref.current;
    const focusable = dialogDom.querySelectorAll();
    document.activeElement = focusable.at(-1);
    document.dispatch("keydown", keyEvent("Tab"));
    expect(document.activeElement).toBe(focusable[0]);
    document.activeElement = dialogDom;
    document.dispatch("keydown", keyEvent("Tab", true));
    expect(document.activeElement).toBe(focusable.at(-1));
  });

  it("blocks dismissal and duplicate saves while saving, then preserves the task patch", async () => {
    const pending = deferred();
    const props = baseProps({ onUpdateTask: vi.fn(() => pending.promise) });
    const runner = createRunner(props);
    const form = findElement(runner.output, (node) => node.type === "form");
    const submitEvent = { preventDefault: vi.fn() };
    const firstSubmission = form.props.onSubmit(submitEvent);
    form.props.onSubmit(submitEvent);
    runner.render();

    document.dispatch("keydown", keyEvent("Escape"));
    const backdrop = findElement(runner.output, (node) => node.props?.className?.includes("task-modal-backdrop"));
    const target = {};
    backdrop.props.onMouseDown({ target, currentTarget: target });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onUpdateTask).toHaveBeenCalledTimes(1);

    pending.resolve();
    await firstSubmission;
    expect(props.onUpdateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        title: "Original task",
        status: "todo",
        completed: false,
        listId: "list-1",
        projectId: "project-1",
      })
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves save error behavior after a rejected update", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const props = baseProps({ onUpdateTask: vi.fn().mockRejectedValue(new Error("offline")) });
    const runner = createRunner(props);
    const form = findElement(runner.output, (node) => node.type === "form");
    await form.props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(props.onClose).not.toHaveBeenCalled();
    expect(textContent(findElement(runner.output, (node) => node.props?.role === "alert"))).toContain("couldn't save");
  });

  it("preserves archive action behavior", async () => {
    const props = baseProps();
    const runner = createRunner(props);
    const archive = findElement(runner.output, (node) => textContent(node) === "Archive task");
    await archive.props.onClick();
    expect(props.onArchiveTask).toHaveBeenCalledWith("task-1");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the nested delete alert dialog as the active focus boundary", () => {
    const props = baseProps();
    const runner = createRunner(props);
    const deleteButton = findElement(runner.output, (node) => textContent(node) === "Delete task");
    deleteButton.props.onClick();
    runner.render();
    const alertDialog = findElement(runner.output, (node) => node.props?.role === "alertdialog");
    const alertDom = alertDialog.props.ref.current;
    const focusable = alertDom.querySelectorAll();
    expect(alertDialog.props["aria-modal"]).toBe("true");
    expect(document.activeElement).toBe(focusable[0]);

    document.activeElement = focusable.at(-1);
    const tab = keyEvent("Tab");
    document.dispatch("keydown", tab);
    window.dispatch("keydown", tab);
    expect(document.activeElement).toBe(focusable[0]);

    const escape = keyEvent("Escape");
    document.dispatch("keydown", escape);
    window.dispatch("keydown", escape);
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "alertdialog")).toBeUndefined();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("does not react to Escape or trap focus after unmount", () => {
    const props = baseProps();
    const runner = createRunner(props);
    runner.unmount();
    const outside = { focus: vi.fn() };
    document.activeElement = outside;
    document.dispatch("keydown", keyEvent("Escape"));
    document.dispatch("keydown", keyEvent("Tab"));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
  });
});
