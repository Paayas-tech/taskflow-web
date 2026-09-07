import { describe, expect, it } from "vitest";
import {
  createFakeApi,
  makeColumn,
  makeProject,
  makeTask,
  makeUser,
} from "../test/fakeApi";
import {
  acceptInvitation,
  createProject,
  declineInvitation,
  deleteProject,
  ensureWorkspace,
  refreshMembers,
  setProjectHealth,
  updateProject,
  WORKSPACE_STALE_MS,
} from "./projects";
import { startSession } from "./session";
import { configureStore, getState, setState, subscribe } from "./store";
import { createTask, moveTasks } from "./tasks";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

/**
 * Holds `name`'s response the way a request still on the wire behaves: the
 * server answers from the data it had when the call was made.
 */
const holdResponse = (api, name) => {
  const original = api[name];
  let release;
  let markStarted;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  api[name] = async (...args) => {
    const result = await original(...args);
    markStarted();
    await gate;
    return result;
  };
  return {
    started,
    release: () => {
      api[name] = original;
      release();
    },
  };
};

/** Holds the request itself: the server has not seen it yet. */
const holdRequest = (api, name) => {
  const original = api[name];
  let release;
  let markStarted;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  api[name] = async (...args) => {
    markStarted();
    await gate;
    return original(...args);
  };
  return {
    started,
    release: () => {
      api[name] = original;
      release();
    },
  };
};

/** Makes the workspace look old enough for the next open to revalidate it. */
const staleWorkspace = () =>
  setState({
    workspaceLoadedAt: { "project-1": Date.now() - WORKSPACE_STALE_MS - 1 },
  });

const seed = (overrides = {}) => ({
  user,
  projects: [makeProject({ id: "project-1", ownerId: user.id, name: "Website relaunch" })],
  columns: [
    makeColumn({ id: "column-todo", projectId: "project-1", category: "todo", position: 0 }),
    makeColumn({ id: "column-done", projectId: "project-1", category: "done", position: 2 }),
  ],
  members: [
    {
      projectId: "project-1",
      userId: user.id,
      role: "owner",
      displayName: "Sam Rivera",
      avatarUrl: null,
    },
  ],
  tasks: [makeTask({ id: "task-1", projectId: "project-1", title: "Draft copy" })],
  attachments: [
    { id: "attachment-1", projectId: "project-1", entityType: "task", entityId: "task-1" },
  ],
  ...overrides,
});

const boot = async (overrides = {}) => {
  const api = createFakeApi(seed(overrides));
  configureStore({ api });
  await startSession(user);
  return api;
};

const workspaceStatus = () => getState().loaded.workspaces["project-1"];

describe("ensureWorkspace", () => {
  it("loads the project's tasks and attachment counts once", async () => {
    const api = await boot();

    await ensureWorkspace("project-1");

    expect(workspaceStatus()).toBe("ready");
    expect(getState().tasks["task-1"].title).toBe("Draft copy");
    expect(getState().attachmentCounts["task-1"]).toBe(1);

    await ensureWorkspace("project-1");
    expect(api.callCount("listProjectTasks")).toBe(1);
  });

  it("revalidates a stale workspace silently", async () => {
    const api = await boot();
    await ensureWorkspace("project-1");

    api.data.tasks.push(
      makeTask({ id: "task-2", projectId: "project-1", title: "Added elsewhere" })
    );
    setState({
      workspaceLoadedAt: { "project-1": Date.now() - WORKSPACE_STALE_MS - 1 },
    });

    const statuses = [];
    const unsubscribe = subscribe((state) =>
      statuses.push(state.loaded.workspaces["project-1"])
    );
    await ensureWorkspace("project-1");
    unsubscribe();

    expect(api.callCount("listProjectTasks")).toBe(2);
    expect(statuses).not.toContain("loading");
    expect(workspaceStatus()).toBe("ready");
    expect(getState().tasks["task-2"].title).toBe("Added elsewhere");
  });

  it("keeps a task created while a stale workspace snapshot is in flight", async () => {
    const api = await boot();
    await ensureWorkspace("project-1");
    staleWorkspace();

    const load = holdResponse(api, "listProjectTasks");
    const refreshing = ensureWorkspace("project-1");
    await load.started;

    const request = holdRequest(api, "createTask");
    const creating = createTask({ title: "Created during refresh", projectId: "project-1" });
    await request.started;
    const createdId = Object.values(getState().tasks).find(
      (task) => task.title === "Created during refresh"
    ).id;

    load.release();
    await refreshing;
    expect(getState().tasks[createdId]?.title).toBe("Created during refresh");

    request.release();
    expect(await creating).toMatchObject({ id: createdId });
  });

  it("keeps a board move made while a stale workspace snapshot is in flight", async () => {
    const api = await boot();
    await ensureWorkspace("project-1");
    staleWorkspace();

    const load = holdResponse(api, "listProjectTasks");
    const refreshing = ensureWorkspace("project-1");
    await load.started;

    const request = holdRequest(api, "reorderTasks");
    const moving = moveTasks("project-1", [
      { taskId: "task-1", columnId: "column-done", position: 0 },
    ]);
    await request.started;

    load.release();
    await refreshing;
    expect(getState().tasks["task-1"]).toMatchObject({
      columnId: "column-done",
      position: 0,
      status: "completed",
    });

    request.release();
    expect(await moving).toBe(true);
  });

  it("reports a workspace it could not load", async () => {
    const api = await boot();
    api.failNext("listProjectTasks", new Error("offline"));

    await ensureWorkspace("project-1");

    expect(workspaceStatus()).toBe("error");
    expect(getState().errors.workspaces["project-1"]).toBe(
      "We couldn't load this project workspace. Check your connection and try again."
    );
  });

  it("creates the default board columns for an editor when a project has none", async () => {
    const api = await boot({ columns: [] });

    await ensureWorkspace("project-1");

    expect(api.callCount("createDefaultColumns")).toBe(1);
    expect(getState().columns["project-1"].map((column) => column.category)).toEqual([
      "todo",
      "in_progress",
      "done",
    ]);
  });

  it("never creates columns for a viewer", async () => {
    const api = await boot({
      columns: [],
      projects: [makeProject({ id: "project-1", ownerId: "user-2" })],
      members: [
        {
          projectId: "project-1",
          userId: user.id,
          role: "viewer",
          displayName: "Sam Rivera",
        },
      ],
    });

    await ensureWorkspace("project-1");

    expect(api.callCount("createDefaultColumns")).toBe(0);
    expect(workspaceStatus()).toBe("ready");
  });
});

describe("project CRUD", () => {
  it("shows a new project immediately and reads its board back", async () => {
    const api = await boot();

    const created = await createProject({ name: "  Mobile app  ", color: "violet" });

    expect(created).toMatchObject({
      name: "Mobile app",
      viewerRole: "owner",
      ownerId: user.id,
      status: "active",
    });
    expect(getState().projects[created.id].name).toBe("Mobile app");
    expect(getState().columns[created.id]).toHaveLength(3);
    expect(getState().members[created.id][0]).toMatchObject({ role: "owner" });
    expect(api.callsOf("createProject")[0][0].id).toBe(created.id);
  });

  it("refuses a project without a name and removes one the server rejects", async () => {
    const api = await boot();

    expect(await createProject({ name: "  " })).toBeNull();
    expect(getState().ui.notice.text).toBe("Project name cannot be empty.");
    expect(api.callCount("createProject")).toBe(0);

    api.failNext("createProject", new Error("offline"));
    expect(await createProject({ name: "Doomed" })).toBeNull();
    expect(Object.keys(getState().projects)).toEqual(["project-1"]);
    expect(getState().ui.notice.text).toBe(
      "We couldn't create this project. Check your connection and try again."
    );
  });

  it("archives a project and rolls back a failed edit", async () => {
    const api = await boot();

    expect(await updateProject("project-1", { status: "archived" })).toBe(true);
    expect(getState().projects["project-1"].status).toBe("archived");
    expect(getState().projects["project-1"].archivedAt).toBeTruthy();

    api.failNext("updateProject", new Error("offline"));
    expect(await updateProject("project-1", { name: "Renamed" })).toBe(false);
    expect(getState().projects["project-1"].name).toBe("Website relaunch");
    expect(getState().ui.notice.text).toBe(
      "We couldn't save this project. Check your connection and try again."
    );
  });

  it("sets the health status through the project update", async () => {
    const api = await boot();

    expect(await setProjectHealth("project-1", "at_risk")).toBe(true);
    expect(getState().projects["project-1"].healthStatus).toBe("at_risk");
    expect(api.callsOf("updateProject")[0][1]).toEqual({ healthStatus: "at_risk" });
  });

  it("deletes a project with its storage attachments and everything it owns", async () => {
    const api = await boot();
    await ensureWorkspace("project-1");

    expect(await deleteProject("project-1")).toBe(true);
    expect(getState().projects["project-1"]).toBeUndefined();
    expect(getState().tasks["task-1"]).toBeUndefined();
    expect(getState().columns["project-1"]).toBeUndefined();
    expect(getState().members["project-1"]).toBeUndefined();
    expect(api.data.attachments).toEqual([]);
    expect(
      api.calls
        .map(([name]) => name)
        .filter((name) => name === "removeAllAttachments" || name === "deleteProject")
    ).toEqual(["removeAllAttachments", "deleteProject"]);
  });

  it("restores the project and its rows when deletion fails", async () => {
    const api = await boot();
    await ensureWorkspace("project-1");
    api.failNext("deleteProject", new Error("offline"));

    expect(await deleteProject("project-1")).toBe(false);
    expect(getState().projects["project-1"]).toBeTruthy();
    expect(getState().tasks["task-1"]).toBeTruthy();
    expect(getState().columns["project-1"]).toHaveLength(2);
  });
});

describe("invitations", () => {
  const invitationSeed = {
    invitations: [
      {
        id: "invitation-1",
        projectId: "project-2",
        email: "sam@example.com",
        role: "editor",
        inviterId: "user-2",
        status: "pending",
        project: makeProject({ id: "project-2", ownerId: "user-2", name: "Mobile app" }),
      },
    ],
  };

  it("accepts an invitation and quietly picks up the new project", async () => {
    const api = await boot(invitationSeed);
    expect(getState().invitations).toHaveLength(1);

    expect(await acceptInvitation("invitation-1")).toBe(true);

    expect(getState().invitations).toEqual([]);
    expect(getState().projects["project-2"]).toMatchObject({
      name: "Mobile app",
      viewerRole: "editor",
    });
    expect(api.callCount("listProjects")).toBe(2);
  });

  it("puts a declined invitation back when the response fails", async () => {
    const api = await boot(invitationSeed);
    api.failNext("respondToInvitation", new Error("offline"));

    expect(await declineInvitation("invitation-1")).toBe(false);
    expect(getState().invitations).toHaveLength(1);
    expect(getState().ui.notice.text).toBe("We couldn't update this invitation. Try again.");

    expect(await declineInvitation("invitation-1")).toBe(true);
    expect(getState().invitations).toEqual([]);
  });
});

describe("refreshMembers", () => {
  it("re-reads one project's roster and its profiles", async () => {
    const api = await boot();
    api.data.members.push({
      projectId: "project-1",
      userId: "user-2",
      role: "editor",
      displayName: "Alex Chen",
      avatarUrl: null,
    });

    const members = await refreshMembers("project-1");

    expect(members).toHaveLength(2);
    expect(getState().members["project-1"]).toHaveLength(2);
    expect(getState().profiles["user-2"].displayName).toBe("Alex Chen");
  });
});
