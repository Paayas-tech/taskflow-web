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
    const client = { from: vi.fn(() => query) };
    const repository = createProjectRepository(client);

    await repository.getProjectTask("user-a", "project-a", "task-a");

    expect(query.calls).toContainEqual(["eq", "id", "task-a"]);
    expect(query.calls).toContainEqual(["eq", "project_id", "project-a"]);
    expect(query.calls).not.toContainEqual(["eq", "created_by", "user-a"]);
  });

  it("creates normalized owner invitations", async () => {
    const query = queryResult({
      data: {
        id: "invite-a", project_id: "project-a", email: "member@example.com",
        role: "editor", inviter_id: "owner-a", status: "pending",
      },
      error: null,
    });
    query.insert = function insert(...args) { this.calls.push(["insert", ...args]); return this; };
    query.single = function single() { this.calls.push(["single"]); return Promise.resolve(this.result); };
    query.result = {
      data: {
        id: "invite-a", project_id: "project-a", email: "member@example.com",
        role: "editor", inviter_id: "owner-a", status: "pending",
      },
      error: null,
    };
    const repository = createProjectRepository({ from: vi.fn(() => query) });

    const invitation = await repository.createProjectInvitation("owner-a", "project-a", {
      email: "member@example.com", role: "editor", expiresAt: "2030-01-01T00:00:00.000Z",
    });

    expect(invitation).toEqual(expect.objectContaining({ id: "invite-a", role: "editor" }));
    expect(query.calls).toContainEqual(["insert", expect.objectContaining({
      project_id: "project-a", email_normalized: "member@example.com",
    })]);
  });
});
