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
vi.mock("../application/projectService", () => services);

import ProjectMembersModal from "./ProjectMembersModal";

const mountedRunners = new Set();

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};

const walk = (node, visitor) => {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visitor));
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  childrenOf(node).forEach((child) => walk(child, visitor));
};

const findAll = (root, predicate) => {
  const found = [];
  walk(root, (node) => predicate(node) && found.push(node));
  return found;
};
const find = (root, predicate) => findAll(root, predicate)[0];
const textContent = (node) => {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
};

const notice = (root, tone) => find(root, (node) => node.props?.tone === tone);
const memberRows = (root) => findAll(root, (node) => Boolean(node.props?.member));
const invitationRows = (root) => findAll(root, (node) => Boolean(node.props?.invitation));
const confirmRemoval = (root) => find(root, (node) => node.props?.confirmLabel === "Remove");
const inviteForm = (root) => find(root, (node) => node.type === "form");
const emailInput = (root) => find(root, (node) => node.props?.type === "email");
const labelled = (root, label) => find(root, (node) => node.props?.["aria-label"] === label);

function createRunner(props) {
  const runner = { cursor: 0, pending: [], slots: [], output: null };
  function render() {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = ProjectMembersModal(props);
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
  const api = { render, unmount, get output() { return runner.output; } };
  mountedRunners.add(api);
  render();
  return api;
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
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
  vi.spyOn(console, "error").mockImplementation(() => {});
  services.getProjectMembers.mockReset().mockResolvedValue([
    { userId: "owner-1", displayName: "Ada Owner", role: "owner" },
    { userId: "member-1", displayName: "Priya Shah", role: "editor" },
  ]);
  services.getProjectInvitations.mockReset().mockResolvedValue([]);
  services.createProjectInvitation.mockReset().mockResolvedValue(undefined);
  services.cancelProjectInvitation.mockReset().mockResolvedValue(undefined);
  services.removeProjectMember.mockReset().mockResolvedValue(undefined);
  services.updateProjectMemberRole.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  vi.restoreAllMocks();
});

describe("ProjectMembersModal", () => {
  it("renders the members dialog and lists the roster", async () => {
    const props = baseProps();
    const runner = createRunner(props);

    expect(runner.output.props.title).toBe("Members");
    expect(runner.output.props.size).toBe("md");
    expect(runner.output.props.open).toBe(true);
    expect(runner.output.props.onClose).toBe(props.onClose);
    expect(textContent(runner.output)).toContain("Loading members…");

    await finishLoading(runner);

    expect(services.getProjectMembers).toHaveBeenCalledWith("owner-1", "project-1");
    expect(memberRows(runner.output).map((row) => row.props.member.userId)).toEqual([
      "owner-1",
      "member-1",
    ]);
    expect(memberRows(runner.output)[0].props.ownerId).toBe("owner-1");
    expect(memberRows(runner.output)[0].props.canManage).toBe(true);
  });

  it("hides invite controls and invitation loading from non-owners", async () => {
    const runner = createRunner(baseProps({
      project: { id: "project-1", name: "Launch", ownerId: "owner-1", viewerRole: "editor" },
    }));
    await finishLoading(runner);

    expect(services.getProjectInvitations).not.toHaveBeenCalled();
    expect(inviteForm(runner.output)).toBeUndefined();
    expect(memberRows(runner.output)[0].props.canManage).toBe(false);
  });

  it("shows a retry action when the roster fails to load", async () => {
    services.getProjectMembers.mockRejectedValueOnce(new Error("offline"));
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    const failure = notice(runner.output, "error");
    expect(textContent(failure)).toContain("We couldn't load this project roster.");
    expect(textContent(failure.props.action)).toBe("Try again");

    failure.props.action.props.onClick();
    await finishLoading(runner);
    expect(services.getProjectMembers).toHaveBeenCalledTimes(2);
  });

  it("blocks duplicate invitations while busy and confirms success", async () => {
    const pending = deferred();
    services.createProjectInvitation.mockReturnValue(pending.promise);
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    emailInput(runner.output).props.onChange({ target: { value: "invitee@example.test" } });
    runner.render();
    const firstSubmission = inviteForm(runner.output).props.onSubmit({ preventDefault: vi.fn() });
    runner.render();
    inviteForm(runner.output).props.onSubmit({ preventDefault: vi.fn() });

    expect(runner.output.props.busy).toBe(true);
    expect(services.createProjectInvitation).toHaveBeenCalledTimes(1);
    expect(services.createProjectInvitation).toHaveBeenCalledWith("owner-1", "project-1", {
      email: "invitee@example.test",
      role: "editor",
      projectName: "Launch",
    });

    pending.resolve();
    await firstSubmission;
    runner.render();

    expect(textContent(notice(runner.output, "success"))).toContain("Invitation sent.");
    expect(runner.output.props.busy).toBe(false);
    expect(emailInput(runner.output).props.value).toBe("");
  });

  it("keeps the chosen access level in the invitation payload", async () => {
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    emailInput(runner.output).props.onChange({ target: { value: "viewer@example.test" } });
    labelled(runner.output, "Invitation access").props.onChange({ target: { value: "viewer" } });
    runner.render();
    await inviteForm(runner.output).props.onSubmit({ preventDefault: vi.fn() });

    expect(services.createProjectInvitation).toHaveBeenCalledWith("owner-1", "project-1", {
      email: "viewer@example.test",
      role: "viewer",
      projectName: "Launch",
    });
  });

  it("surfaces invitation failures", async () => {
    services.createProjectInvitation.mockRejectedValue(new Error("Invitation unavailable"));
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    emailInput(runner.output).props.onChange({ target: { value: "invitee@example.test" } });
    runner.render();
    await inviteForm(runner.output).props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(textContent(notice(runner.output, "error"))).toContain("Invitation unavailable");
  });

  it("cancels a pending invitation from its row", async () => {
    services.getProjectInvitations.mockResolvedValue([
      { id: "invite-1", email: "invitee@example.test", role: "editor", status: "pending" },
    ]);
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    const row = invitationRows(runner.output)[0];
    expect(row.props.invitation.id).toBe("invite-1");
    await row.props.onCancel(row.props.invitation);

    expect(services.cancelProjectInvitation).toHaveBeenCalledWith("owner-1", "project-1", "invite-1");
  });

  it("removes a member only after the confirmation dialog and restores focus on cancel", async () => {
    const runner = createRunner(baseProps());
    await finishLoading(runner);
    expect(confirmRemoval(runner.output).props.open).toBe(false);

    const trigger = { focus: vi.fn() };
    const editorRow = memberRows(runner.output)[1];
    editorRow.props.onRemove(editorRow.props.member, trigger);
    runner.render();

    const confirmation = confirmRemoval(runner.output);
    expect(confirmation.props.open).toBe(true);
    expect(confirmation.props.danger).toBe(true);
    expect(confirmation.props.description).toContain("Priya Shah");
    expect(services.removeProjectMember).not.toHaveBeenCalled();

    confirmation.props.onCancel();
    runner.render();
    expect(trigger.focus).toHaveBeenCalledTimes(1);
    expect(confirmRemoval(runner.output).props.open).toBe(false);

    editorRow.props.onRemove(editorRow.props.member, trigger);
    runner.render();
    confirmRemoval(runner.output).props.onConfirm();
    await Promise.resolve();

    expect(services.removeProjectMember).toHaveBeenCalledWith("owner-1", "project-1", "member-1");
  });

  it("applies a role change optimistically and rolls it back on failure", async () => {
    services.updateProjectMemberRole.mockRejectedValueOnce(new Error("Role change refused"));
    const runner = createRunner(baseProps());
    await finishLoading(runner);

    const editorRow = memberRows(runner.output)[1];
    const change = editorRow.props.onRoleChange(editorRow.props.member, "viewer");
    runner.render();
    expect(memberRows(runner.output)[1].props.member.role).toBe("viewer");

    await change;
    runner.render();
    expect(memberRows(runner.output)[1].props.member.role).toBe("editor");
    expect(textContent(notice(runner.output, "error"))).toContain("Role change refused");
  });

  it("returns focus to the opener when it closes", () => {
    const returnFocusElement = { focus: vi.fn() };
    const runner = createRunner(baseProps({ returnFocusElement }));

    expect(returnFocusElement.focus).not.toHaveBeenCalled();
    runner.unmount();
    expect(returnFocusElement.focus).toHaveBeenCalledTimes(1);
  });
});
