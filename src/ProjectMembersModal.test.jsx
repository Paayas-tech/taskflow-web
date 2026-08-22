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
  cancelProjectInvitation: vi.fn(),
  createProjectInvitation: vi.fn(),
  getProjectInvitations: vi.fn(),
  getProjectMembers: vi.fn(),
  removeProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("./application/projectService", () => services);
vi.mock("./MemberRow", () => ({
  default: ({ member, onRemove, onRoleChange, busy }) => (
    <article>
      <span>{member.userId}</span>
      <button type="button" disabled={busy} onClick={() => onRoleChange(member, "viewer")}>Change role</button>
      <button type="button" disabled={busy} onClick={(event) => onRemove(member, event.currentTarget)}>Remove {member.userId}</button>
    </article>
  ),
}));
vi.mock("./InvitationRow", () => ({
  default: ({ invitation, onCancel, busy }) => (
    <button type="button" disabled={busy} onClick={() => onCancel(invitation)}>Cancel invitation</button>
  ),
}));

import ProjectMembersModal from "./ProjectMembersModal";

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
    querySelector() { return element.querySelectorAll()[0] ?? null; },
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
    runner.output = resolveNode(ProjectMembersModal(props));
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
    userId: "owner-1",
    project: {
      id: "project-1",
      name: "Launch",
      ownerId: "owner-1",
      viewerRole: "owner",
    },
    onClose: vi.fn(),
    ...overrides,
  };
}

async function finishLoading(runner) {
  await Promise.resolve();
  await Promise.resolve();
  runner.render();
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
    requestAnimationFrame: (callback) => { callback(); return 1; },
    cancelAnimationFrame: vi.fn(),
  };
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  services.getProjectMembers.mockReset().mockResolvedValue([
    { userId: "member-1", role: "editor" },
  ]);
  services.getProjectInvitations.mockReset().mockResolvedValue([]);
  services.createProjectInvitation.mockReset().mockResolvedValue(undefined);
  services.cancelProjectInvitation.mockReset().mockResolvedValue(undefined);
  services.removeProjectMember.mockReset().mockResolvedValue(undefined);
  services.updateProjectMemberRole.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.getComputedStyle;
  vi.restoreAllMocks();
});

describe("ProjectMembersModal lifecycle integration", () => {
  it("preserves dialog semantics, initial focus, and body scroll locking", () => {
    document.body.style.overflow = "clip";
    const runner = createRunner(baseProps());
    const dialog = findElement(runner.output, (node) => node.props?.role === "dialog");
    const title = findElement(
      runner.output,
      (node) => node.props?.id === dialog.props["aria-labelledby"]
    );
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(dialog.props.tabIndex).toBe(-1);
    expect(textContent(title)).toBe("Project members");
    expect(document.activeElement).toBe(dialog.props.ref.current);
    expect(document.body.style.overflow).toBe("hidden");
    runner.unmount();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("preserves Escape, backdrop, content, Close, and cleanup focus behavior", () => {
    const returnFocusElement = { focus: vi.fn() };
    const props = baseProps({ returnFocusElement });
    const escapeRunner = createRunner(props);
    document.dispatch("keydown", keyEvent("Escape"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    escapeRunner.unmount();
    expect(returnFocusElement.focus).toHaveBeenCalledTimes(1);

    const backdropProps = baseProps();
    const backdropRunner = createRunner(backdropProps);
    const backdrop = findElement(
      backdropRunner.output,
      (node) => node.props?.className === "task-modal-backdrop"
    );
    backdrop.props.onMouseDown({ target: {}, currentTarget: {} });
    expect(backdropProps.onClose).not.toHaveBeenCalled();
    const sameTarget = {};
    backdrop.props.onMouseDown({ target: sameTarget, currentTarget: sameTarget });
    expect(backdropProps.onClose).toHaveBeenCalledTimes(1);
    const close = findElement(
      backdropRunner.output,
      (node) => node.type === "button" && textContent(node) === "Close"
    );
    close.props.onClick();
    expect(backdropProps.onClose).toHaveBeenCalledTimes(2);
  });

  it("traps Tab and Shift+Tab within the outer dialog", async () => {
    const runner = createRunner(baseProps());
    await finishLoading(runner);
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

  it("blocks dismissal and duplicate invitations while busy, preserving payload", async () => {
    const pending = deferred();
    services.createProjectInvitation.mockReturnValue(pending.promise);
    const props = baseProps();
    const runner = createRunner(props);
    await finishLoading(runner);
    let emailInput = findElement(runner.output, (node) => node.props?.type === "email");
    emailInput.props.onChange({ target: { value: "invitee@example.test" } });
    runner.render();
    let form = findElement(runner.output, (node) => node.type === "form");
    const firstSubmission = form.props.onSubmit({ preventDefault: vi.fn() });
    runner.render();
    form = findElement(runner.output, (node) => node.type === "form");
    form.props.onSubmit({ preventDefault: vi.fn() });

    document.dispatch("keydown", keyEvent("Escape"));
    const backdrop = findElement(runner.output, (node) => node.props?.className === "task-modal-backdrop");
    const target = {};
    backdrop.props.onMouseDown({ target, currentTarget: target });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(services.createProjectInvitation).toHaveBeenCalledTimes(1);
    expect(services.createProjectInvitation).toHaveBeenCalledWith(
      "owner-1",
      "project-1",
      {
        email: "invitee@example.test",
        role: "editor",
        projectName: "Launch",
      }
    );

    pending.resolve();
    await firstSubmission;
    runner.render();
    expect(textContent(findElement(runner.output, (node) => node.props?.role === "status"))).toContain("Invitation sent");
  });

  it("preserves invitation error behavior", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    services.createProjectInvitation.mockRejectedValue(new Error("Invitation unavailable"));
    const runner = createRunner(baseProps());
    await finishLoading(runner);
    findElement(runner.output, (node) => node.props?.type === "email").props.onChange({ target: { value: "invitee@example.test" } });
    runner.render();
    await findElement(runner.output, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    runner.render();
    expect(textContent(findElement(runner.output, (node) => node.props?.role === "alert"))).toContain("Invitation unavailable");
  });

  it("keeps the nested removal alert dialog as the active focus boundary", async () => {
    const props = baseProps();
    const runner = createRunner(props);
    await finishLoading(runner);
    const remove = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Remove member-1"
    );
    const removeTrigger = { focus: vi.fn() };
    remove.props.onClick({ currentTarget: removeTrigger });
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
    expect(removeTrigger.focus).toHaveBeenCalledTimes(1);
  });

  it("preserves remove-member callback shape", async () => {
    const runner = createRunner(baseProps());
    await finishLoading(runner);
    const remove = findElement(runner.output, (node) => textContent(node) === "Remove member-1");
    remove.props.onClick({ currentTarget: { focus: vi.fn() } });
    runner.render();
    const confirm = findElement(runner.output, (node) => textContent(node) === "Remove member");
    confirm.props.onClick();
    await Promise.resolve();
    expect(services.removeProjectMember).toHaveBeenCalledWith(
      "owner-1",
      "project-1",
      "member-1"
    );
  });

  it("does not react to Escape or trap focus after unmount", () => {
    const props = baseProps();
    const runner = createRunner(props);
    runner.unmount();
    const outside = {};
    document.activeElement = outside;
    document.dispatch("keydown", keyEvent("Escape"));
    document.dispatch("keydown", keyEvent("Tab"));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
  });
});
