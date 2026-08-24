import { describe, expect, it, vi } from "vitest";
import ActivityRow from "./ActivityRow";
import InvitationRow from "./InvitationRow";
import MemberRow from "./MemberRow";
import TaskAssigneeSelector from "./TaskAssigneeSelector";

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

    expect(textContent(output)).toContain("Editor access from Priya Shah");
    expect(textContent(output)).not.toContain(internalId);
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

    expect(textContent(output)).toContain("Viewer access from TaskFlow user");
    expect(textContent(output)).not.toContain(internalId);
  });

  it("shows member names in member and assignee controls without IDs", () => {
    const member = { userId: internalId, displayName: "Priya Shah", role: "editor" };
    const memberRow = MemberRow({
      member,
      ownerId: "owner-id",
      canManage: true,
      busy: false,
      onRoleChange: vi.fn(),
      onRemove: vi.fn(),
    });
    const selector = TaskAssigneeSelector({
      assigneeId: "",
      members: [member],
      onChange: vi.fn(),
    });

    expect(textContent(memberRow)).toContain("Priya Shah");
    expect(textContent(selector)).toContain("Priya Shah · editor");
    expect(textContent(memberRow)).not.toContain(internalId);
    expect(textContent(selector)).not.toContain(internalId);
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
  });
});
