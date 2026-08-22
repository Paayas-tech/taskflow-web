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
        (nextValue) => {
          slot.value =
            typeof nextValue === "function" ? nextValue(slot.value) : nextValue;
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
      activeRunner.slots[index] ??= { value: "notification-dialog-test" };
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

const services = vi.hoisted(() => ({
  deleteNotification: vi.fn(),
  getNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useId: hookRuntime.useId,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

vi.mock("./application/notificationService", () => services);

import NotificationsPanel from "./NotificationsPanel";

const mountedRunners = new Set();

function childElements(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(Boolean);
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const child of childElements(node)) walk(child, visitor);
}

function findElement(root, predicate) {
  let match;
  walk(root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childElements(node).map(textContent).join("");
}

function createDomElement(node, parent = null) {
  const descendants = [];
  const tabIndex = node.props?.tabIndex ?? (node.type === "button" || node.type === "a" ? 0 : -1);
  const element = {
    node,
    parent,
    disabled: Boolean(node.props?.disabled),
    hidden: Boolean(node.props?.hidden),
    isConnected: true,
    tabIndex,
    descendants,
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
  };

  for (const childNode of childElements(node)) {
    if (typeof childNode === "object") descendants.push(createDomElement(childNode, element));
  }
  if (node.props?.ref && typeof node.props.ref === "object") node.props.ref.current = element;
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
  const runner = {
    cursor: 0,
    pending: [],
    slots: [],
    output: undefined,
    dom: undefined,
  };

  function render(nextProps = props) {
    props = nextProps;
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = NotificationsPanel(props);
    runner.dom = createDomElement(runner.output);

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
    get dom() {
      return runner.dom;
    },
  };
  mountedRunners.add(api);
  render();
  return api;
}

function openPanel(runner) {
  const trigger = findElement(
    runner.output,
    (node) => node.type === "button" && textContent(node).startsWith("Notifications")
  );
  trigger.props.onClick();
  runner.render();
  return {
    dialog: findElement(runner.output, (node) => node.props?.role === "dialog"),
    trigger: findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Notifications")
    ),
  };
}

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  services.getNotifications.mockReset().mockResolvedValue([]);
  services.subscribeToNotifications.mockReset().mockReturnValue(() => {});
  services.markNotificationRead.mockReset().mockResolvedValue(undefined);
  services.markAllNotificationsRead.mockReset().mockResolvedValue(undefined);
  services.deleteNotification.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.getComputedStyle;
});

describe("NotificationsPanel modal lifecycle integration", () => {
  it("renders its existing dialog semantics and focuses the panel without locking scroll", () => {
    document.body.style.overflow = "auto";
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    const { dialog } = openPanel(runner);
    const dialogDom = findElement(runner.output, (node) => node === dialog).props.ref.current;

    expect(dialog.props.role).toBe("dialog");
    expect(dialog.props["aria-label"]).toBe("Notifications");
    expect(dialog.props.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(dialogDom);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes on Escape and returns focus to its trigger", () => {
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    const { trigger } = openPanel(runner);
    const triggerDom = trigger.props.ref.current;

    document.dispatch("keydown", keyEvent("Escape"));
    expect(document.activeElement).toBe(triggerDom);
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("ignores Escape while closed", () => {
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    document.dispatch("keydown", keyEvent("Escape"));
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("keeps inside clicks open and closes outside without restoring trigger focus", () => {
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    const { dialog, trigger } = openPanel(runner);
    const dialogDom = dialog.props.ref.current;
    const triggerDom = trigger.props.ref.current;
    triggerDom.focus.mockClear();

    document.dispatch("mousedown", { target: dialogDom });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();

    document.dispatch("mousedown", { target: {} });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
    expect(triggerDom.focus).not.toHaveBeenCalled();
  });

  it("contains Tab and Shift+Tab within the open panel", () => {
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    const { dialog } = openPanel(runner);
    const dialogDom = dialog.props.ref.current;
    const focusable = dialogDom.querySelectorAll();

    document.activeElement = focusable.at(-1);
    document.dispatch("keydown", keyEvent("Tab"));
    expect(document.activeElement).toBe(focusable[0]);

    document.activeElement = dialogDom;
    document.dispatch("keydown", keyEvent("Tab", true));
    expect(document.activeElement).toBe(focusable.at(-1));
  });

  it("preserves notification read and project navigation behavior", async () => {
    const notification = {
      id: "notification-1",
      type: "task_assigned",
      projectId: "project-1",
      readAt: null,
      data: { taskTitle: "Review work" },
    };
    services.getNotifications.mockResolvedValue([notification]);
    const onNavigate = vi.fn();
    const runner = createRunner({ userId: "user-1", onNavigate });
    await Promise.resolve();
    await Promise.resolve();
    runner.render();
    openPanel(runner);

    const notificationButton = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).includes("You were assigned Review work")
    );
    await notificationButton.props.onClick();

    expect(services.markNotificationRead).toHaveBeenCalledWith(
      "user-1",
      "notification-1"
    );
    expect(onNavigate).toHaveBeenCalledWith("/projects/project-1");
  });

  it("restores the prior scroll value when unmounted", () => {
    document.body.style.overflow = "clip";
    const runner = createRunner({ userId: "user-1", onNavigate: vi.fn() });
    openPanel(runner);
    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });
});
