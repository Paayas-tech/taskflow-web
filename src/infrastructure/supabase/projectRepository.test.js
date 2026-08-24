import { describe, expect, it, vi } from "vitest";
import { createProjectRepository } from "./projectRepository";

const queryResult = (result = { data: [], error: null }) => {
  const calls = [];
  const query = {
    calls,
    select(...args) { calls.push(["select", ...args]); return this; },
    eq(...args) { calls.push(["eq", ...args]); return this; },
    order(...args) { calls.push(["order", ...args]); return this; },
    maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
};

describe("Supabase project repository", () => {
  it("batches visible profile IDs through the constrained RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ user_id: "user-a", display_name: "Ada", avatar_url: null }],
      error: null,
    });
    const repository = createProjectRepository({ rpc });

    await expect(
      repository.getVisibleUserProfiles(["user-a", "user-a", null])
    ).resolves.toEqual([
      { userId: "user-a", displayName: "Ada", avatarUrl: null },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_visible_user_profiles", {
      target_user_ids: ["user-a"],
    });
  });

  it("loads RLS-accessible projects and resolves the viewer role", async () => {
    const projectsQuery = queryResult({
      data: [{ id: "project-a", owner_id: "owner-a", name: "Shared" }],
      error: null,
    });
    const membershipQuery = queryResult({
      data: [{ project_id: "project-a", user_id: "user-a", role: "editor" }],
      error: null,
    });
    const client = {
      from: vi.fn((table) => table === "projects" ? projectsQuery : membershipQuery),
    };
    const repository = createProjectRepository(client);

    const projects = await repository.getProjects("user-a");

    expect(client.from).toHaveBeenCalledWith("projects");
    expect(projects).toEqual([
      expect.objectContaining({ id: "project-a", viewerRole: "editor" }),
    ]);
    expect(membershipQuery.calls).toContainEqual(["eq", "user_id", "user-a"]);
  });

  it("scopes a project task read by project and task id while RLS checks membership", async () => {
    const query = queryResult({ data: null, error: null });
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn().mockResolvedValue({
        data: [{ user_id: "user-a", display_name: "Ada", avatar_url: null }],
        error: null,
      }),
    };
    const repository = createProjectRepository(client);

    await repository.getProjectTask("user-a", "project-a", "task-a");

    expect(query.calls).toContainEqual(["eq", "id", "task-a"]);
    expect(query.calls).toContainEqual(["eq", "project_id", "project-a"]);
    expect(query.calls).not.toContainEqual(["eq", "created_by", "user-a"]);
  });

  it("filters assigned project tasks by the authenticated user", async () => {
    const query = queryResult({
      data: [{ id: "task-a", task_assignments: [{ user_id: "user-a" }] }],
      error: null,
    });
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn().mockResolvedValue({
        data: [{ user_id: "user-a", display_name: "Ada", avatar_url: null }],
        error: null,
      }),
    };
    const repository = createProjectRepository(client);

    const tasks = await repository.getAssignedProjectTasks("user-a");

    expect(client.from).toHaveBeenCalledWith("tasks");
    expect(query.calls).toContainEqual([
      "eq",
      "task_assignments.user_id",
      "user-a",
    ]);
    expect(tasks).toHaveLength(1);
  });

  it("propagates assigned-task provider failures", async () => {
    const providerError = new Error("provider unavailable");
    const query = queryResult({ data: null, error: providerError });
    const repository = createProjectRepository({ from: vi.fn(() => query) });

    await expect(
      repository.getAssignedProjectTasks("user-a")
    ).rejects.toBe(providerError);
  });

  it("invokes the authenticated invitation email function", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    });
    const repository = createProjectRepository({ functions: { invoke } });

    const invitation = await repository.createProjectInvitation("owner-a", "project-a", {
      email: "member@example.com", role: "editor", projectName: "Launch",
    });

    expect(invitation).toEqual({ success: true });
    expect(invoke).toHaveBeenCalledWith("send-invitation-email", {
      body: {
        projectId: "project-a",
        inviteeEmail: "member@example.com",
        role: "editor",
        projectName: "Launch",
      },
    });
  });

  it("does not expose raw function errors", async () => {
    const repository = createProjectRepository({
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("sensitive provider detail"),
        }),
      },
    });

    await expect(repository.createProjectInvitation("owner-a", "project-a", {
      email: "member@example.com", role: "editor",
    })).rejects.toThrow("We couldn't send this invitation. Try again.");
  });
});
