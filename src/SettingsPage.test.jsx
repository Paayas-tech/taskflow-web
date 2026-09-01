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
    activate(runner) { activeRunner = runner; },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [slot.value, (next) => {
        slot.value = typeof next === "function" ? next(slot.value) : next;
      }];
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useMemo(factory, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) return previous.value;
      const value = factory();
      activeRunner.slots[index] = { value, dependencies };
      return value;
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
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("./services/reminderService", () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
}));
vi.mock("./application/googleCalendarIntegrationService", () => ({
  googleCalendarIntegrationService: {
    getConnection: vi.fn().mockResolvedValue(null),
    startOAuth: vi.fn(),
    sync: vi.fn(),
    disconnect: vi.fn(),
  },
}));

import SettingsPage from "./SettingsPage";
import { DEFAULT_SETTINGS } from "./domain/settingsDomain";

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
  const tabIndex = node.props?.tabIndex ??
    (["button", "input", "select", "textarea", "a"].includes(node.type) ? 0 : -1);
  const element = {
    node,
    descendants,
    disabled: Boolean(node.props?.disabled),
    hidden: Boolean(node.props?.hidden),
    isConnected: true,
    tabIndex,
    focus: vi.fn(() => { document.activeElement = element; }),
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
  for (const child of childrenOf(node)) {
    const childDom = createDom(child);
    if (Array.isArray(childDom)) descendants.push(...childDom.filter(Boolean));
    else if (childDom) descendants.push(childDom);
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
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
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
    runner.output = resolveNode(SettingsPage(props));
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
    get output() { return runner.output; },
  };
  mountedRunners.add(api);
  render();
  return api;
}

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

function baseProps(overrides = {}) {
  return {
    settings: DEFAULT_SETTINGS,
    loading: false,
    error: "",
    saving: false,
    saveMessage: "",
    onRetry: vi.fn(),
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCommit: vi.fn().mockResolvedValue(undefined),
    onSignOut: vi.fn(),
    onNavigate: vi.fn(),
    onOpenProjectCreate: vi.fn(),
    onRestoreProject: vi.fn(),
    exportData: { projects: [], lists: [] },
    ...overrides,
  };
}

function openCalendarDialog(runner) {
  let connect = findElement(
    runner.output,
    (node) => node.type === "button" && textContent(node) === "Setup required"
  );
  if (!connect) {
    const calendars = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Calendars")
    );
    calendars.props.onClick();
    runner.render();
    connect = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Setup required"
    );
  }
  connect.props.onClick();
  runner.render();
  return findElement(runner.output, (node) => node.props?.role === "dialog");
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

describe("SettingsPage calendar modal lifecycle integration", () => {
  it("opens the existing profile editor when requested by the completion prompt", () => {
    const runner = createRunner(baseProps({ profileRequest: 1 }));
    runner.render();

    expect(textContent(runner.output)).toContain("My Profile");
    expect(textContent(runner.output)).toContain("Profile information");
    expect(textContent(runner.output)).not.toContain("This name is visible to people you collaborate with.");
    expect(textContent(runner.output)).not.toContain("Use the name your teammates will recognize.");
    expect(textContent(runner.output)).not.toContain("Your sign-in email is managed securely by your TaskFlow account.");
    expect(textContent(runner.output)).toContain("Signed in");
    expect(textContent(runner.output)).toContain("Sign out");
    expect(textContent(runner.output)).toContain("Delete account");
    expect(findElement(runner.output, (node) => node.props?.type === "text")).toBeDefined();
    expect(findElement(runner.output, (node) => node.props?.type === "email" && node.props?.readOnly)).toBeDefined();
  });

  it("resets a previously opened profile subsection when Settings home is explicitly requested", () => {
    const runner = createRunner(baseProps({ profileRequest: 1, homeRequest: 0 }));
    runner.render();
    expect(textContent(runner.output)).toContain("Profile information");

    const homeProps = baseProps({ profileRequest: 0, homeRequest: 1 });
    runner.render(homeProps);
    runner.render(homeProps);

    expect(findElement(runner.output, (node) => node.props?.className === "settings-overview")).toBeDefined();
    expect(textContent(runner.output)).not.toContain("Profile information");
  });

  it("opens My Profile directly after another Settings subsection was active", () => {
    const runner = createRunner(baseProps());
    const backgrounds = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Background")
    );
    backgrounds.props.onClick();
    runner.render();
    expect(textContent(runner.output)).toContain("Choose Background");

    const profileProps = baseProps({ profileRequest: 1, homeRequest: 0 });
    runner.render(profileProps);
    runner.render(profileProps);

    expect(textContent(runner.output)).toContain("My Profile");
    expect(textContent(runner.output)).toContain("Profile information");
    expect(textContent(runner.output)).not.toContain("Choose Background");
  });

  it("keeps account actions out of the settings overview", () => {
    const runner = createRunner(baseProps());
    runner.render();

    expect(textContent(runner.output)).not.toContain("Sign out");
    expect(textContent(runner.output)).not.toContain("Delete account");
  });

  it("preserves dialog semantics, absent initial focus, and body scroll locking", () => {
    document.body.style.overflow = "clip";
    const outside = {};
    document.activeElement = outside;
    const runner = createRunner(baseProps());
    const dialog = openCalendarDialog(runner);
    const title = findElement(
      runner.output,
      (node) => node.props?.id === dialog.props["aria-labelledby"]
    );
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(textContent(title)).toContain("Connect Microsoft Outlook");
    expect(dialog.props.tabIndex).toBeUndefined();
    expect(document.activeElement).toBe(outside);
    expect(document.body.style.overflow).toBe("hidden");
    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("closes on Escape and restores body scrolling", () => {
    document.body.style.overflow = "auto";
    const runner = createRunner(baseProps());
    openCalendarDialog(runner);
    document.dispatch("keydown", keyEvent("Escape"));
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("distinguishes backdrop, content, and explicit Close interactions", () => {
    const runner = createRunner(baseProps());
    openCalendarDialog(runner);
    let backdrop = findElement(
      runner.output,
      (node) => node.props?.className === "settings-connection-backdrop"
    );
    backdrop.props.onMouseDown({ target: {}, currentTarget: {} });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeDefined();

    backdrop = findElement(runner.output, (node) => node.props?.className === "settings-connection-backdrop");
    const sameTarget = {};
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();

    openCalendarDialog(runner);
    const close = findElement(
      runner.output,
      (node) => node.props?.["aria-label"] === "Close calendar connection setup"
    );
    close.props.onClick();
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("preserves the modal's existing lack of Tab trapping", () => {
    const runner = createRunner(baseProps());
    const dialog = openCalendarDialog(runner);
    const dialogDom = dialog.props.ref.current;
    const focusable = dialogDom.querySelectorAll();
    document.activeElement = focusable.at(-1);
    const tab = keyEvent("Tab");
    document.dispatch("keydown", tab);
    expect(document.activeElement).toBe(focusable.at(-1));
    expect(tab.preventDefault).not.toHaveBeenCalled();
  });

  it("remains dismissible when the unrelated settings saving flag is active", () => {
    const runner = createRunner(baseProps({ saving: true }));
    openCalendarDialog(runner);
    document.dispatch("keydown", keyEvent("Escape"));
    runner.render();
    expect(findElement(runner.output, (node) => node.props?.role === "dialog")).toBeUndefined();
  });

  it("does not react to Escape or Tab while closed or after unmount", () => {
    const runner = createRunner(baseProps());
    const outside = {};
    document.activeElement = outside;
    const tab = keyEvent("Tab");
    document.dispatch("keydown", keyEvent("Escape"));
    document.dispatch("keydown", tab);
    expect(document.activeElement).toBe(outside);
    expect(tab.preventDefault).not.toHaveBeenCalled();
    runner.unmount();
    document.dispatch("keydown", keyEvent("Escape"));
  });

  it("preserves immediate settings commit payload and error ownership", async () => {
    const commit = vi.fn().mockRejectedValue(new Error("offline"));
    const props = baseProps({ onCommit: commit });
    const runner = createRunner(props);
    const theme = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Theme")
    );
    theme.props.onClick();
    runner.render();
    const dark = findElement(
      runner.output,
      (node) => node.props?.type === "radio" && node.props?.value === "dark"
    );
    await expect(dark.props.onChange()).resolves.toBeUndefined();
    const expectedSettings = { ...DEFAULT_SETTINGS, theme: { mode: "dark" } };
    expect(props.onChange).toHaveBeenCalledWith(expectedSettings);
    expect(commit).toHaveBeenCalledWith(expectedSettings);
    expect(findElement(runner.output, (node) => node.props?.role === "alert")).toBeUndefined();
  });
});

describe("SettingsPage project reminders coordination", () => {
  it("keeps offset edits draft-only and commits the full immediate-toggle payload", () => {
    const props = baseProps();
    const runner = createRunner(props);
    const projectReminders = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Project Reminders")
    );

    projectReminders.props.onClick();
    runner.render();

    const defaultTime = findElement(
      runner.output,
      (node) => node.props?.type === "number"
    );
    defaultTime.props.onChange({ target: { value: "45" } });
    expect(props.onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, defaultTime: 45 },
    });
    expect(props.onCommit).not.toHaveBeenCalled();

    props.onChange.mockClear();
    const inAppReminders = findElement(
      runner.output,
      (node) => node.props?.type === "checkbox"
    );
    inAppReminders.props.onChange({ target: { checked: false } });
    const expectedSettings = {
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, enableInAppReminders: false },
    };
    expect(props.onChange).toHaveBeenCalledWith(expectedSettings);
    expect(props.onCommit).toHaveBeenCalledWith(expectedSettings);
  });
});

describe("SettingsPage background coordination", () => {
  it("commits the complete coupled background and appearance payload", async () => {
    const props = baseProps();
    const runner = createRunner(props);
    const background = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Background")
    );

    background.props.onClick();
    runner.render();

    const options = [];
    walk(runner.output, (node) => {
      if (
        node.type === "button" &&
        String(node.props?.className || "").includes("settings-background-option")
      ) {
        options.push(node);
      }
    });
    const nextOption = options.find(
      (option) => !option.props.className.includes("is-selected")
    );
    const nextBackgroundId = nextOption.props.className.match(
      /background-(?!option)([^ ]+)/
    )[1];
    const nextBackgroundName = textContent(
      findElement(nextOption, (node) => node.type === "strong")
    );

    nextOption.props.onClick();
    const expectedSettings = {
      ...DEFAULT_SETTINGS,
      background: { selected: nextBackgroundId },
      appearance: { ...DEFAULT_SETTINGS.appearance, background: nextBackgroundId },
    };
    expect(props.onChange).toHaveBeenCalledWith(expectedSettings);
    expect(props.onCommit).toHaveBeenCalledWith(expectedSettings);
    await Promise.resolve();
    runner.render();
    expect(
      textContent(findElement(runner.output, (node) => node.props?.role === "status"))
    ).toContain(`${nextBackgroundName} background saved.`);
  });
});

describe("SettingsPage archived projects coordination", () => {
  const archivedProject = {
    id: "project/id with spaces",
    name: "Archived Alpha",
    description: "Archived project description",
    status: "archived",
  };

  function openArchivedProjects(runner) {
    const archivedProjects = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).startsWith("Archived Projects")
    );
    archivedProjects.props.onClick();
    runner.render();
  }

  it("keeps encoded project navigation in the coordinator", () => {
    const props = baseProps({ exportData: { projects: [archivedProject], lists: [] } });
    const runner = createRunner(props);
    openArchivedProjects(runner);
    const view = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "View"
    );

    view.props.onClick();
    expect(props.onNavigate).toHaveBeenCalledWith(
      `/projects/${encodeURIComponent(archivedProject.id)}`
    );
  });

  it("preserves pending state, restore cleanup, and the success message", async () => {
    let resolveRestore;
    const restorePending = new Promise((resolve) => { resolveRestore = resolve; });
    const props = baseProps({
      exportData: { projects: [archivedProject], lists: [] },
      onRestoreProject: vi.fn(() => restorePending),
    });
    const runner = createRunner(props);
    openArchivedProjects(runner);
    let restore = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Restore"
    );

    restore.props.onClick();
    expect(props.onRestoreProject).toHaveBeenCalledWith(archivedProject.id);
    runner.render();
    restore = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Restoring..."
    );
    expect(restore.props.disabled).toBe(true);

    resolveRestore();
    await restorePending;
    await Promise.resolve();
    runner.render();
    restore = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Restore"
    );
    expect(restore.props.disabled).toBe(false);
    expect(
      textContent(findElement(runner.output, (node) => node.props?.role === "status"))
    ).toContain("Archived Alpha restored.");
  });

  it("preserves the sanitized restore failure and clears pending state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const props = baseProps({
      exportData: { projects: [archivedProject], lists: [] },
      onRestoreProject: vi.fn().mockRejectedValue(new Error("provider details")),
    });
    const runner = createRunner(props);
    openArchivedProjects(runner);
    findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Restore"
    ).props.onClick();

    await Promise.resolve();
    await Promise.resolve();
    runner.render();
    const status = findElement(runner.output, (node) => node.props?.role === "status");
    expect(textContent(status)).toContain("We couldn't restore Archived Alpha. Try again.");
    expect(textContent(status)).not.toContain("provider details");
    expect(
      findElement(runner.output, (node) => node.type === "button" && textContent(node) === "Restore")
        .props.disabled
    ).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
