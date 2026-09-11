import { describe, expect, it } from "vitest";
import {
  createFakeApi,
  makeColumn,
  makeProject,
  makeTask,
  makeUser,
} from "../test/fakeApi";
import {
  createSelector,
  enrichTask,
  selectArchivedTasks,
  selectMyTasks,
  selectProjects,
  selectSearchItems,
  selectTask,
  selectUnreadCount,
  selectWorkspace,
} from "./selectors";
import { ensureWorkspace } from "./projects";
import { startSession } from "./session";
import { configureStore, getState, setState } from "./store";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const boot = async (overrides = {}) => {
  const api = createFakeApi({
    user,
    projects: [
      makeProject({ id: "project-1", ownerId: user.id, name: "Website relaunch" }),
      makeProject({
        id: "project-2",
        ownerId: "user-2",
        name: "Mobile app",
        createdAt: "2026-01-02T09:00:00.000Z",
      }),
    ],
    columns: [
      makeColumn({ id: "column-todo", projectId: "project-1", category: "todo" }),
    ],
    members: [
      {
        projectId: "project-1",
        userId: user.id,
        role: "owner",
        displayName: "Sam Rivera",
        avatarUrl: null,
      },
      {
        projectId: "project-1",
        userId: "user-2",
        role: "editor",
        displayName: "Alex Chen",
        avatarUrl: null,
      },
      {
        projectId: "project-2",
        userId: user.id,
        role: "viewer",
        displayName: "Sam Rivera",
        avatarUrl: null,
      },
    ],
    tasks: [
      makeTask({ id: "task-personal", title: "Buy milk" }),
      makeTask({
        id: "task-archived",
        title: "Old idea",
        archivedAt: "2026-01-05T10:00:00.000Z",
      }),
      makeTask({
        id: "story-1",
        projectId: "project-1",
        workType: "story",
        title: "Launch",
      }),
      makeTask({
        id: "task-mine",
        projectId: "project-1",
        title: "Draft copy",
        assigneeId: user.id,
        storyId: "story-1",
      }),
      makeTask({
        id: "task-theirs",
        projectId: "project-1",
        title: "Not mine",
        assigneeId: "user-2",
      }),
    ],
    attachments: [
      {
        id: "attachment-1",
        projectId: "project-1",
        entityType: "task",
        entityId: "task-mine",
      },
    ],
    notifications: [
      { id: "notification-1", userId: user.id, type: "comment", data: {}, readAt: null },
      {
        id: "notification-2",
        userId: user.id,
        type: "comment",
        data: {},
        readAt: "2026-02-02T08:00:00.000Z",
      },
    ],
    ...overrides,
  });
  configureStore({ api });
  await startSession(user);
  return api;
};

describe("createSelector", () => {
  it("recomputes only when an input reference changes", () => {
    configureStore({ api: createFakeApi() });
    let runs = 0;
    const selectTitles = createSelector([(state) => state.tasks], (tasks) => {
      runs += 1;
      return Object.values(tasks).map((task) => task.title);
    });

    const first = selectTitles(getState());
    setState({ searchOpen: true });
    expect(selectTitles(getState())).toBe(first);
    expect(runs).toBe(1);

    setState({ tasks: { "task-1": { id: "task-1", title: "Ship it" } } });
    expect(selectTitles(getState())).toEqual(["Ship it"]);
    expect(runs).toBe(2);
  });
});

describe("selectMyTasks", () => {
  it("lists my personal and assigned work, enriched, without other people's tasks", async () => {
    await boot();
    await ensureWorkspace("project-1");

    const tasks = selectMyTasks(getState());
    expect(tasks.map((task) => task.id)).toEqual(["task-personal", "task-mine"]);

    const assigned = tasks[1];
    expect(assigned).toMatchObject({
      projectName: "Website relaunch",
      projectStatus: "active",
      assigneeName: "Sam Rivera",
      storyName: "Launch",
      attachmentCount: 1,
    });
  });

  it("keeps the same reference until the data behind it changes", async () => {
    await boot();

    const first = selectMyTasks(getState());
    setState({ searchOpen: true });
    expect(selectMyTasks(getState())).toBe(first);

    setState((state) => ({
      tasks: {
        ...state.tasks,
        "task-personal": { ...state.tasks["task-personal"], title: "Buy oat milk" },
      },
    }));
    expect(selectMyTasks(getState())).not.toBe(first);
  });
});

describe("selectArchivedTasks", () => {
  it("lists my archived personal tasks", async () => {
    await boot();

    expect(selectArchivedTasks(getState()).map((task) => task.id)).toEqual([
      "task-archived",
    ]);
  });
});

describe("selectTask", () => {
  it("is cached per id and unlinks a story that is not loaded", async () => {
    await boot();

    expect(selectTask("task-mine")).toBe(selectTask("task-mine"));
    expect(selectTask("task-mine")(getState())).toMatchObject({
      title: "Draft copy",
      storyName: "",
      orphanedStoryId: "story-1",
      storyId: null,
    });
    expect(selectTask("nothing")(getState())).toBeNull();

    await ensureWorkspace("project-1");
    expect(selectTask("task-mine")(getState())).toMatchObject({
      storyName: "Launch",
      storyId: "story-1",
      orphanedStoryId: null,
    });
  });
});

describe("selectWorkspace", () => {
  it("splits a loaded project into tasks, stories and archived stories", async () => {
    await boot();
    await ensureWorkspace("project-1");
    setState((state) => ({
      tasks: {
        ...state.tasks,
        "story-2": {
          ...makeTask({ id: "story-2", projectId: "project-1", workType: "story" }),
          archivedAt: "2026-01-06T10:00:00.000Z",
        },
      },
    }));

    const workspace = selectWorkspace("project-1")(getState());
    expect(selectWorkspace("project-1")).toBe(selectWorkspace("project-1"));
    expect(workspace.status).toBe("ready");
    expect(workspace.project.name).toBe("Website relaunch");
    expect(workspace.tasks.map((task) => task.id).sort()).toEqual([
      "task-mine",
      "task-theirs",
    ]);
    expect(workspace.stories.map((story) => story.id)).toEqual(["story-1"]);
    expect(workspace.archivedStories.map((story) => story.id)).toEqual(["story-2"]);
    expect(workspace.columns).toHaveLength(1);
    expect(workspace.members).toHaveLength(2);
    expect(workspace.canEdit).toBe(true);
  });

  it("marks a project the viewer may only read", async () => {
    await boot();

    expect(selectWorkspace("project-2")(getState())).toMatchObject({
      status: "idle",
      canEdit: false,
    });
  });
});

describe("search and notifications", () => {
  it("offers projects, my tasks and stories to the search dialog", async () => {
    await boot();
    await ensureWorkspace("project-1");

    const items = selectSearchItems(getState());
    expect(items.filter((item) => item.type === "project")).toHaveLength(2);
    expect(items.find((item) => item.id === "task:task-mine").subtitle).toBe(
      "Website relaunch"
    );
    expect(items.find((item) => item.id === "task:task-personal").subtitle).toBe(
      "Personal task"
    );
    expect(items.find((item) => item.id === "story:story-1")).toMatchObject({
      title: "Launch",
      subtitle: "Website relaunch",
    });
  });

  it("counts unread notifications and sorts projects oldest first", async () => {
    await boot();

    expect(selectUnreadCount(getState())).toBe(1);
    expect(selectProjects(getState()).map((project) => project.id)).toEqual([
      "project-1",
      "project-2",
    ]);
  });
});

describe("enrichTask", () => {
  it("names the project, assignee and story a row shows", async () => {
    await boot();
    await ensureWorkspace("project-1");

    expect(enrichTask(getState().tasks["task-theirs"], getState())).toMatchObject({
      projectName: "Website relaunch",
      assigneeName: "Alex Chen",
      attachmentCount: 0,
    });
    expect(enrichTask(null, getState())).toBeNull();
  });
});
