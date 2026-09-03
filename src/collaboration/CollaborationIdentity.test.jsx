import { describe, expect, it, vi } from "vitest";
import ActivityRow from "./ActivityRow";
import InvitationRow from "./InvitationRow";
import MemberRow from "./MemberRow";

const internalId = "414b9bdb-dad5-467e-b361-8d3cb82eeac8";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};

const textContent = (node) => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return childrenOf(node).map(textContent).join("");
};

const propValues = (node) => {
  const values = [];
  const walk = (candidate) => {
    if (Array.isArray(candidate)) return candidate.forEach(walk);
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, value] of Object.entries(candidate.props ?? {})) {
      if (key !== "children" && typeof value === "string") values.push(value);
    }
    childrenOf(candidate).forEach(walk);
  };
  walk(node);
  return values.join(" ");
};

describe("collaboration identity presentation", () => {
  it("shows the inviter name without exposing the inviter ID", () => {
    const output = InvitationRow({
      invitation: {
        id: "invite-1",
        role: "editor",
        status: "pending",
        inviterId: internalId,
        inviterDisplayName: "Priya Shah",
        project: { name: "Launch plan" },
      },
      incoming: true,
      onAccept: vi.fn(),
      onDecline: vi.fn(),
    });

    expect(textContent(output)).toContain("Launch plan");
    expect(textContent(output)).toContain("Invited by Priya Shah · Editor");
    expect(textContent(output)).not.toContain(internalId);
    expect(propValues(output)).not.toContain(internalId);
  });

  it("uses the safe fallback when an inviter profile is missing", () => {
    const output = InvitationRow({
      invitation: {
        id: "invite-1",
        role: "viewer",
        status: "pending",
        inviterId: internalId,
        project: { name: "Launch plan" },
      },
      incoming: true,
      onAccept: vi.fn(),
      onDecline: vi.fn(),
    });

    expect(textContent(output)).toContain("Invited by TaskFlow user · Viewer");
    expect(textContent(output)).not.toContain(internalId);
    expect(propValues(output)).not.toContain(internalId);
  });

  it("shows member names in the member row without IDs", () => {
    const member = { userId: internalId, displayName: "Priya Shah", role: "editor" };
    const memberRow = MemberRow({
      member,
      ownerId: "owner-id",
      canManage: true,
      busy: false,
      onRoleChange: vi.fn(),
      onRemove: vi.fn(),
    });

    expect(textContent(memberRow)).toContain("Priya Shah");
    expect(textContent(memberRow)).not.toContain(internalId);
    expect(propValues(memberRow)).not.toContain(internalId);
  });

  it("shows activity actors by name or safe fallback, never by ID", () => {
    const named = ActivityRow({
      activity: {
        userId: internalId,
        displayName: "Priya Shah",
        type: "task_status_changed",
        metadata: { taskTitle: "Training run" },
      },
    });
    const unnamed = ActivityRow({
      activity: { userId: internalId, type: "task_created", metadata: {} },
    });

    expect(textContent(named)).toContain("Priya Shah");
    expect(textContent(unnamed)).toContain("TaskFlow user");
    expect(textContent(named)).not.toContain(internalId);
    expect(textContent(unnamed)).not.toContain(internalId);
    expect(propValues(named)).not.toContain(internalId);
  });
});
