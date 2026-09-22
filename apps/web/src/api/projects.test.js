import { describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

vi.mock("./client", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-1"),
  apiRequest: apiRequestMock,
  throwIfError: (error) => {
    if (error) throw error;
  },
}));

import {
  listProjects,
  rowToProject,
  sendInvitation,
  viewerRoleForRow,
} from "./projects";

const row = {
  id: "project-1",
  owner_id: "user-1",
  name: "Launch",
  description: "Ship it",
  color: "#336699",
  status: "active",
  health_status: "at_risk",
  due_date: "2026-04-01",
  archived_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const withMembers = {
  ...row,
  project_members: [
    { user_id: "user-1", role: "owner" },
    { user_id: "user-2", role: "editor" },
  ],
};

describe("rowToProject", () => {
  it("maps a project row to the app shape", () => {
    expect(rowToProject(row, "owner")).toEqual({
      id: "project-1",
      ownerId: "user-1",
      name: "Launch",
      description: "Ship it",
      color: "#336699",
      status: "active",
      healthStatus: "at_risk",
      dueDate: "2026-04-01",
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      viewerRole: "owner",
      healthSupported: true,
    });
  });

  it("falls back to a readable name, an active status and on_track health", () => {
    expect(rowToProject({ id: "p" })).toMatchObject({
      name: "Untitled project",
      status: "active",
      healthStatus: "on_track",
      healthSupported: false,
      dueDate: "",
      viewerRole: null,
    });
  });

  it("carries the role it is handed through, and null when there is none", () => {
    expect(rowToProject(row, "editor").viewerRole).toBe("editor");
    expect(rowToProject(row, undefined).viewerRole).toBeNull();
  });
});

/** The derivation `listProjects` runs over every row it reads. */
describe("viewerRoleForRow", () => {
  it.each([
    ["the owner", "user-1", "owner"],
    ["a member", "user-2", "editor"],
    ["a stranger", "user-3", null],
  ])("derives the viewer role for %s", (_label, userId, expected) => {
    expect(viewerRoleForRow(withMembers, userId)).toBe(expected);
  });

  it("owns the project even when the membership row is missing", () => {
    expect(viewerRoleForRow(row, "user-1")).toBe("owner");
  });

  it("has no role in a project it cannot see a membership for", () => {
    expect(viewerRoleForRow({}, "user-1")).toBeNull();
  });
});

describe("listProjects", () => {
  it("maps REST project rows", async () => {
    const legacyRow = { ...withMembers };
    delete legacyRow.health_status;
    legacyRow.viewer_role = "owner";
    apiRequestMock.mockResolvedValue([legacyRow]);

    const first = await listProjects("user-1");
    expect(first[0]).toMatchObject({
      id: "project-1",
      viewerRole: "owner",
      healthStatus: "on_track",
      healthSupported: false,
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/projects");
  });
});

describe("sendInvitation", () => {
  it.each([
    ["", "Enter a valid email address."],
    ["not-an-email", "Enter a valid email address."],
    ["missing@domain", "Enter a valid email address."],
  ])("rejects the address %j before calling Supabase", async (email, message) => {
    await expect(
      sendInvitation("project-1", { email, role: "editor" })
    ).rejects.toThrow(message);
  });

  it.each(["", "owner", "admin"])(
    "rejects the role %j before calling Supabase",
    async (role) => {
      await expect(
        sendInvitation("project-1", { email: "person@example.com", role })
      ).rejects.toThrow("Choose either Editor or Viewer access.");
    }
  );
});
