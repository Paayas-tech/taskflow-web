import { describe, expect, it } from "vitest";
import {
  createFakeApi,
  makeColumn,
  makeProject,
  makeTask,
  makeUser,
} from "../test/fakeApi";
import {
  endSession,
  handleAuthEvent,
  REVALIDATE_MS,
  revalidate,
  startSession,
} from "./session";
import { configureStore, getState, setState, subscribe } from "./store";
import { updateProject } from "./projects";
import { createTask, moveTasks, updateTask } from "./tasks";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const seed = () => ({
  user,
  projects: [makeProject({ id: "project-1", ownerId: user.id, name: "Website relaunch" })],
  columns: [
    makeColumn({ id: "column-done", projectId: "project-1", category: "done", position: 2 }),
    makeColumn({ id: "column-todo", projectId: "project-1", category: "todo", position: 0 }),
  ],
  members: [
    {
      projectId: "project-1",
      userId: user.id,
      role: "owner",
      joinedAt: "2026-01-01T09:00:00.000Z",
      displayName: "Sam Rivera",
      avatarUrl: null,
    },
  ],
  tasks: [
    makeTask({ id: "task-personal", title: "Buy milk" }),
    makeTask({
      id: "task-assigned",
      title: "Draft copy",
      projectId: "project-1",
      assigneeId: user.id,
      columnId: "column-todo",
    }),
    makeTask({ id: "task-someone-else", title: "Not mine", projectId: "project-1" }),
  ],
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
  notifications: [
    {
      id: "notification-1",
      userId: user.id,
      type: "task_assigned",
      data: {},
      readAt: null,
      createdAt: "2026-02-01T08:00:00.000Z",
    },
  ],
});

const boot = async (overrides = {}) => {
  const api = createFakeApi({ ...seed(), ...overrides });
  configureStore({ api });
  await startSession(user);
  return api;
};

/** Holds only the next response, allowing a new session to use the api normally. */
const holdNextResponse = (api, name) => {
  const original = api[name];
  let release;
  let markStarted;
  let held = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });

  api[name] = async (...args) => {
    if (held) return original(...args);
    held = true;
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

/** Holds every request under `name` before it reaches the fake server. */
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

describe("startSession", () => {
  it("loads every slice in parallel and marks them ready", async () => {
    const api = await boot();
    const state = getState();

    expect(state.auth).toMatchObject({ status: "ready", user });
    expect(state.loaded).toMatchObject({
      tasks: "ready",
      projects: "ready",
      invitations: "ready",
      settings: "ready",
      notifications: "ready",
    });
    expect(Object.keys(state.tasks).sort()).toEqual(["task-assigned", "task-personal"]);
    expect(state.projects["project-1"].viewerRole).toBe("owner");
    expect(state.columns["project-1"].map((column) => column.id)).toEqual([
      "column-todo",
      "column-done",
    ]);
    expect(state.members["project-1"]).toHaveLength(1);
    expect(state.profiles["user-1"].displayName).toBe("Sam Rivera");
    expect(state.invitations).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    expect(state.settings.navigation.defaultView).toBe("dashboard");

    // Every core request runs once.
    expect(api.callCount("listPersonalTasks")).toBe(1);
    expect(api.callCount("listProjects")).toBe(1);
  });

  it("records the failing slice only", async () => {
    const api = createFakeApi(seed());
    api.failNext("listProjects", new Error("offline"));
    configureStore({ api });
    await startSession(user);

    const state = getState();
    expect(state.loaded.projects).toBe("error");
    expect(state.errors.projects).toBe(
      "We couldn't load your projects. Check your connection and try again."
    );
    expect(state.loaded.tasks).toBe("ready");
    expect(state.projects).toEqual({});
  });

  it("keeps the inbox live: a realtime change reloads it silently", async () => {
    const api = await boot();
    api.data.notifications = [
      ...api.data.notifications,
      {
        id: "notification-2",
        userId: user.id,
        type: "comment",
        data: {},
        readAt: null,
        createdAt: "2026-02-02T08:00:00.000Z",
      },
    ];

    api.emit("notifications");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getState().notifications).toHaveLength(2);
    expect(getState().loaded.notifications).toBe("ready");
  });

  it("marks inbox live updates as paused when its channel cannot open", async () => {
    const api = createFakeApi(seed());
    api.failNext("subscribeToNotifications", new Error("realtime unavailable"));
    configureStore({ api });

    await startSession(user);

    expect(getState().notificationsLive).toBe(false);
  });
});

describe("endSession", () => {
  it("drops the data, the subscription and the signed-in user", async () => {
    const api = await boot();

    endSession();
    expect(getState().auth).toEqual({
      status: "signed-out",
      user: null,
      recovery: false,
    });
    expect(getState().tasks).toEqual({});
    expect(getState().notifications).toEqual([]);

    const callsBefore = api.callCount("listNotifications");
    api.emit("notifications");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.callCount("listNotifications")).toBe(callsBefore);
  });

  it("cannot let an old account's in-flight task load land in a new session", async () => {
    const api = createFakeApi(seed());
    configureStore({ api });
    const oldLoad = holdNextResponse(api, "listPersonalTasks");

    const oldSession = startSession(user);
    await oldLoad.started;
    endSession();

    const other = makeUser({ id: "user-2", email: "alex@example.com" });
    api.data.user = other;
    api.data.tasks = [
      makeTask({ id: "task-other", title: "Alex's task", createdBy: other.id }),
    ];
    await startSession(other);

    oldLoad.release();
    await oldSession;

    expect(getState().auth.user.id).toBe(other.id);
    expect(Object.keys(getState().tasks)).toEqual(["task-other"]);
  });

  it("cannot let an old mutation patch or clear pending state in a new session", async () => {
    const api = await boot();
    const oldResponse = holdNextResponse(api, "updateTask");
    const oldMutation = updateTask("task-assigned", { title: "Old account edit" });
    await oldResponse.started;

    endSession();
    const other = makeUser({ id: "user-2", email: "alex@example.com" });
    api.data.user = other;
    api.data.tasks = [
      makeTask({
        id: "task-assigned",
        title: "New session task",
        projectId: "project-1",
        assigneeId: other.id,
        columnId: "column-todo",
      }),
    ];
    await startSession(other);

    const newResponse = holdNextResponse(api, "updateTask");
    const newMutation = updateTask("task-assigned", { title: "New account edit" });
    await newResponse.started;

    oldResponse.release();
    expect(await oldMutation).toBe(false);
    expect(getState().tasks["task-assigned"].title).toBe("New account edit");
    expect(getState().pending["task-assigned"]).toBe(1);

    newResponse.release();
    expect(await newMutation).toBe(true);
    expect(getState().pending["task-assigned"]).toBeUndefined();
  });
});

describe("revalidate", () => {
  it("does nothing while the last load is fresh", async () => {
    const api = await boot();
    const before = api.callCount("listPersonalTasks");

    expect(await revalidate()).toBe(false);
    expect(api.callCount("listPersonalTasks")).toBe(before);
  });

  it("reloads silently once the data is stale", async () => {
    const api = await boot();
    api.data.tasks.push(makeTask({ id: "task-new", title: "Added elsewhere" }));
    setState({ lastCoreLoadAt: Date.now() - REVALIDATE_MS - 1 });

    const statuses = [];
    const stop = subscribeToTasksStatus(statuses);
    expect(await revalidate()).toBe(true);
    stop();

    expect(getState().tasks["task-new"].title).toBe("Added elsewhere");
    expect(statuses).not.toContain("loading");
  });

  it("keeps a personal task created while a refocus snapshot is in flight", async () => {
    const api = await boot();
    setState({ lastCoreLoadAt: Date.now() - REVALIDATE_MS - 1 });
    const load = holdNextResponse(api, "listPersonalTasks");

    const refreshing = revalidate();
    await load.started;
    const request = holdRequest(api, "createTask");
    const creating = createTask({ title: "Created during refocus" });
    await request.started;
    const createdId = Object.values(getState().tasks).find(
      (task) => task.title === "Created during refocus"
    ).id;

    load.release();
    await refreshing;
    expect(getState().tasks[createdId]?.title).toBe("Created during refocus");

    request.release();
    expect(await creating).toMatchObject({ id: createdId });
  });

  it("keeps a board move made while a refocus snapshot is in flight", async () => {
    const api = await boot();
    setState({ lastCoreLoadAt: Date.now() - REVALIDATE_MS - 1 });
    const load = holdNextResponse(api, "listAssignedTasks");

    const refreshing = revalidate();
    await load.started;
    const request = holdRequest(api, "reorderTasks");
    const moving = moveTasks("project-1", [
      { taskId: "task-assigned", columnId: "column-done", position: 0 },
    ]);
    await request.started;

    load.release();
    await refreshing;
    expect(getState().tasks["task-assigned"]).toMatchObject({
      columnId: "column-done",
      position: 0,
      status: "completed",
    });

    request.release();
    expect(await moving).toBe(true);
  });

  it("keeps a project edit made while a refocus snapshot is in flight", async () => {
    const api = await boot();
    setState({ lastCoreLoadAt: Date.now() - REVALIDATE_MS - 1 });
    const load = holdNextResponse(api, "listProjects");

    const refreshing = revalidate();
    await load.started;
    expect(await updateProject("project-1", { name: "Newer name" })).toBe(true);

    load.release();
    await refreshing;
    expect(getState().projects["project-1"].name).toBe("Newer name");
  });
});

describe("handleAuthEvent", () => {
  it("routes a recovery link to the recovery screen", async () => {
    await boot();

    await handleAuthEvent("PASSWORD_RECOVERY", user);
    expect(getState().auth.recovery).toBe(true);
    expect(getState().ui.path).toBe("/recover");
  });

  it("ends the session when the user signs out", async () => {
    await boot();

    await handleAuthEvent("SIGNED_OUT", null);
    expect(getState().auth.status).toBe("signed-out");
    expect(getState().tasks).toEqual({});
  });

  it("starts a fresh session for a different user", async () => {
    const api = await boot();
    const other = makeUser({ id: "user-2", email: "alex@example.com" });
    api.data.tasks = [makeTask({ id: "task-other", title: "Alex's task", createdBy: other.id })];

    await handleAuthEvent("SIGNED_IN", other);

    expect(getState().auth.user).toEqual(other);
    expect(Object.keys(getState().tasks)).toEqual(["task-other"]);
  });

  it("keeps the session for the same user", async () => {
    const api = await boot();
    const before = api.callCount("listPersonalTasks");

    await handleAuthEvent("TOKEN_REFRESHED", { ...user, displayName: "Sam R." });

    expect(api.callCount("listPersonalTasks")).toBe(before);
    expect(getState().auth.user.displayName).toBe("Sam R.");
  });
});

/** Records every `loaded.tasks` value the store publishes. */
function subscribeToTasksStatus(statuses) {
  let last = getState().loaded.tasks;
  return subscribe((state) => {
    if (state.loaded.tasks === last) return;
    last = state.loaded.tasks;
    statuses.push(last);
  });
}
