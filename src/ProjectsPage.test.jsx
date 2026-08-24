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

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("./InvitationRow", () => ({ default: () => null }));

import ProjectsPage from "./ProjectsPage";

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

function findElements(root, predicate) {
  const matches = [];
  walk(root, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
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

function createDocument() {
  const listeners = new Map();
  return {
    activeElement: null,
    body: { style: { overflow: "" } },
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
  const runner = { cursor: 0, pending: [], slots: [], output: null };

  function render(nextProps = props) {
    props = nextProps;
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = resolveNode(ProjectsPage(props));
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
    get props() {
      return props;
    },
    get output() {
      return runner.output;
    },
  };
  mountedRunners.add(api);
  render();
  return api;
}

function baseProps(overrides = {}) {
  const triggerNode = {
    type: "button",
    props: { children: "+ New Project" },
  };
  const triggerElement = {
    node: triggerNode,
    isConnected: true,
    focus: vi.fn(() => {
      document.activeElement = triggerElement;
    }),
  };
  return {
    projects: [],
    loading: false,
    error: "",
    onRetry: vi.fn(),
    onCreateProject: vi.fn().mockResolvedValue(undefined),
    onUpdateProject: vi.fn().mockResolvedValue(undefined),
    onDeleteProject: vi.fn().mockResolvedValue(undefined),
    onOpenProject: vi.fn(),
    userId: "user-a",
    onRetryInvitations: vi.fn(),
    onAcceptInvitation: vi.fn(),
    onDeclineInvitation: vi.fn(),
    createRequest: 0,
    createTriggerRef: { current: triggerElement },
    ...overrides,
  };
}

function openCreateDialog(runner) {
  const trigger = runner.props.createTriggerRef.current.node;
  runner.render({
    ...runner.props,
    createRequest: runner.props.createRequest + 1,
  });
  runner.render();
  return {
    trigger,
    dialog: findElement(runner.output, (node) => node.props?.id === "create-project-dialog"),
  };
}

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.getComputedStyle;
  vi.restoreAllMocks();
});

describe("ProjectsPage modal lifecycle integration", () => {
  it("leaves the global Projects heading singular and keeps compact page actions", () => {
    const runner = createRunner(baseProps({
      projects: [
        { id: "owned", name: "Owned", ownerId: "user-a", viewerRole: "owner", status: "active" },
        { id: "viewer", name: "Viewer", ownerId: "user-b", viewerRole: "viewer", status: "active" },
      ],
    }));
    const internalProjectsHeadings = findElements(
      runner.output,
      (node) => ["h1", "h2"].includes(node.type) && textContent(node) === "Projects"
    );

    expect(internalProjectsHeadings).toHaveLength(0);
    expect(findElement(runner.output, (node) => node.type === "button" && textContent(node) === "+ New Project")).toBeUndefined();
    expect(textContent(runner.output)).toContain("My Projects");
    expect(textContent(runner.output)).toContain("Shared with Me");
    expect(textContent(runner.output)).toContain("Viewer");
  });

  it("renders owner, editor, and viewer projects in consistent sections", () => {
    const projects = [
      {
        id: "owned-project",
        name: "Owned project",
        description: "Owner workspace",
        status: "active",
        ownerId: "user-a",
        viewerRole: "owner",
      },
      {
        id: "editor-project",
        name: "Editor project",
        description: "Editable shared workspace",
        status: "active",
        ownerId: "user-b",
        viewerRole: "editor",
      },
      {
        id: "viewer-project",
        name: "Viewer project",
        description: "Read-only shared workspace",
        status: "active",
        ownerId: "user-c",
        viewerRole: "viewer",
      },
    ];
    const runner = createRunner(baseProps({ projects }));
    const ownedSection = findElement(
      runner.output,
      (node) => node.props?.["aria-labelledby"] === "owned-projects-title"
    );
    const sharedSection = findElement(
      runner.output,
      (node) => node.props?.["aria-labelledby"] === "shared-projects-title"
    );
    const sharedArticles = findElements(
      sharedSection,
      (node) => node.type === "article"
    );

    expect(textContent(ownedSection)).toContain("Owned project");
    expect(textContent(ownedSection)).not.toContain("Editor project");
    expect(textContent(ownedSection)).not.toContain("Viewer project");
    expect(textContent(sharedSection)).toContain("Editor project");
    expect(textContent(sharedSection)).toContain("Viewer project");
    expect(sharedArticles).toHaveLength(2);
    expect(findElements(runner.output, (node) => node.type === "article")).toHaveLength(
      projects.length
    );

    const viewerCard = sharedArticles.find((article) =>
      textContent(article).includes("Viewer project")
    );
    const viewerActions = findElements(
      viewerCard,
      (node) => node.type === "button"
    ).map(textContent);
    expect(viewerActions).toEqual(["View project"]);
  });

  it("preserves dialog semantics, name-field focus, and body scroll locking", () => {
    document.body.style.overflow = "clip";
    const runner = createRunner(baseProps());
    const { dialog } = openCreateDialog(runner);
    const nameInput = findElement(
      runner.output,
      (node) => node.type === "input" && node.props?.name === "name"
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
    expect(textContent(title)).toBe("Create Project");
    expect(textContent(description)).toContain("Give this work area a clear name");
    expect(dialog.props.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(nameInput.props.ref.current);
    expect(document.body.style.overflow).toBe("hidden");

    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("preserves Escape, backdrop, content, and explicit close behavior", () => {
    const runner = createRunner(baseProps());
    openCreateDialog(runner);
    document.dispatch("keydown", keyEvent("Escape"));
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();

    openCreateDialog(runner);
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

    openCreateDialog(runner);
    const close = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Close Create Project dialog"
    );
    close.props.onClick();
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("contains Tab focus and ignores modal keys while closed", () => {
    const runner = createRunner(baseProps());
    const outside = {};
    document.activeElement = outside;
    const closedTab = keyEvent("Tab");
    document.dispatch("keydown", keyEvent("Escape"));
    document.dispatch("keydown", closedTab);
    expect(document.activeElement).toBe(outside);
    expect(closedTab.preventDefault).not.toHaveBeenCalled();

    const { dialog } = openCreateDialog(runner);
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

  it("blocks dismissal and duplicate submission while project creation is pending", async () => {
    const creation = deferred();
    const createProject = vi.fn().mockReturnValue(creation.promise);
    const runner = createRunner(baseProps({ onCreateProject: createProject }));
    const { trigger } = openCreateDialog(runner);
    const nameInput = findElement(
      runner.output,
      (node) => node.type === "input" && node.props?.name === "name"
    );
    nameInput.props.onChange({ target: { name: "name", value: "  Phase 4  " } });
    runner.render();
    const form = findElement(runner.output, (node) => node.props?.className === "project-form");
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
      (node) => node.props?.["aria-label"] === "Close Create Project dialog"
    );
    const sameTarget = {};
    document.dispatch("keydown", keyEvent("Escape"));
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    close.props.onClick();
    runner.render();

    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();
    expect(dialog.props["aria-busy"]).toBe(true);
    expect(createProject).toHaveBeenCalledOnce();

    creation.resolve();
    await submission;
    runner.render();

    expect(createProject).toHaveBeenCalledWith({
      name: "Phase 4",
      description: "",
      color: "#6657c8",
    });
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
    expect(textContent(document.activeElement.node)).toBe(textContent(trigger));
  });

  it("keeps the dialog open with the existing error after creation fails", async () => {
    const createProject = vi.fn().mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const runner = createRunner(baseProps({ onCreateProject: createProject }));
    openCreateDialog(runner);
    const nameInput = findElement(
      runner.output,
      (node) => node.type === "input" && node.props?.name === "name"
    );
    nameInput.props.onChange({ target: { name: "name", value: "Retry project" } });
    runner.render();
    const form = findElement(runner.output, (node) => node.props?.className === "project-form");

    await form.props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();
    expect(textContent(findElement(runner.output, (node) => node.props?.role === "alert"))).toBe(
      "We couldn't create this project. Check your connection and try again."
    );
  });

  it("does not let the outer lifecycle interfere with delete confirmation", () => {
    document.body.style.overflow = "auto";
    const project = {
      id: "project-1",
      name: "Existing project",
      description: "",
      color: "#6657c8",
      status: "active",
      ownerId: "user-a",
    };
    const runner = createRunner(baseProps({ projects: [project] }));
    const deleteButton = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Delete"
    );
    deleteButton.props.onClick();
    runner.render();
    const escape = keyEvent("Escape");
    const tab = keyEvent("Tab");
    document.dispatch("keydown", escape);
    document.dispatch("keydown", tab);
    runner.render();

    expect(findElement(runner.output, (node) => node.props?.role === "alertdialog")).toBeDefined();
    expect(escape.preventDefault).not.toHaveBeenCalled();
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("auto");
  });
});
