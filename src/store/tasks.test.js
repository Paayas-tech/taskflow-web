import { describe, expect, it } from "vitest";
import {
  createFakeApi,
  makeColumn,
  makeProject,
  makeTask,
  makeUser,
} from "../test/fakeApi";
import { ensureWorkspace } from "./projects";
import { startSession } from "./session";
import { configureStore, getState, setState } from "./store";
import {
  archiveTask,
  bulkUpdate,
  createTask,
  deleteTask,
  moveTasks,
  restoreTask,
  setAssignee,
  toggleComplete,
  updateTask,
} from "./tasks";

const user = makeUser({ id: "user-1", email: "sam@example.com" });
const columns = [
  makeColumn({ id: "column-todo", projectId: "project-1", category: "todo", position: 0 }),
  makeColumn({
    id: "column-doing",
    projectId: "project-1",
    category: "in_progress",
    position: 1,
  }),
  makeColumn({ id: "column-done", projectId: "project-1", category: "done", position: 2 }),
];

const seed = (overrides = {}) => ({
  user,
  projects: [makeProject({ id: "project-1", ownerId: user.id, name: "Website relaunch" })],
  columns,
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
  ],
  ...overrides,
});

const boot = async (overrides = {}) => {
  const api = createFakeApi(seed(overrides));
  configureStore({ api });
  await startSession(user);
  return api;
};

const tasksOf = () => getState().tasks;
const notice = () => getState().ui.notice;

/**
 * Holds `name`'s response the way a request still on the wire behaves: the
 * server answers from the data it had when the call was made. Returns the
 * release, which restores the api and delivers that answer.
 */
const holdResponse = (api, name) => {
  const original = api[name];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  api[name] = async (...args) => {
    const result = await original(...args);
    await gate;
    return result;
  };
  return () => {
    api[name] = original;
    release();
  };
};

/** Holds the request itself: the server has not seen it yet. */
const holdRequest = (api, name) => {
  const original = api[name];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  api[name] = async (...args) => {
    await gate;
    return original(...args);
  };
  return () => {
    api[name] = original;
    release();
  };
};

describe("createTask", () => {
  it("adds the task before the request resolves and merges the server row", async () => {
    const api = await boot();

    const pending = createTask({ title: "  Write the brief  ", priority: "high" });
    const optimistic = Object.values(tasksOf())[0];
    expect(optimistic).toMatchObject({
      title: "Write the brief",
      priority: "high",
      status: "todo",
      createdBy: user.id,
      projectId: null,
    });
    expect(optimistic.id).toMatch(/[0-9a-f-]{36}/);
    expect(getState().pending[optimistic.id]).toBe(1);

    const created = await pending;
    expect(created.id).toBe(optimistic.id);
    expect(api.data.tasks.map((task) => task.id)).toContain(optimistic.id);
    expect(getState().pending[optimistic.id]).toBeUndefined();
  });

  it("stamps completedAt when a task is created complete", async () => {
    await boot();

    const created = await createTask({ title: "Already done", status: "completed" });
    expect(created.completed).toBe(true);
    expect(created.completedAt).toBeTruthy();
  });

  it("puts a project task in the column matching its status, after the last card", async () => {
    const api = await boot({
      tasks: [
        makeTask({
          id: "task-1",
          projectId: "project-1",
          columnId: "column-doing",
          position: 3,
          status: "in-progress",
        }),
      ],
    });
    await ensureWorkspace("project-1");

    const created = await createTask({
      title: "Second in progress",
      projectId: "project-1",
      status: "in-progress",
    });

    expect(created).toMatchObject({ columnId: "column-doing", position: 4 });
    expect(api.callsOf("createTask")[0][0]).toMatchObject({
      columnId: "column-doing",
      position: 4,
      createdBy: user.id,
    });
  });

  it("leaves the position to the board when that workspace is not loaded", async () => {
    // Only my own tasks in the project are in the store, so a position
    // computed from them would collide with cards nobody has loaded.
    const api = await boot();

    const created = await createTask({
      title: "Quick add",
      projectId: "project-1",
      status: "todo",
    });

    expect(created).toMatchObject({ columnId: "column-todo", position: null });
    expect(api.callsOf("createTask")[0][0].position).toBeNull();
  });

  it("never derives a negative position from malformed cached rows", async () => {
    await boot({
      tasks: [
        makeTask({
          id: "task-1",
          projectId: "project-1",
          columnId: "column-todo",
          position: -4,
        }),
      ],
    });
    await ensureWorkspace("project-1");

    const created = await createTask({
      title: "Safe position",
      projectId: "project-1",
    });

    expect(created.position).toBe(0);
  });

  it("queues an edit made before the insert has landed", async () => {
    const api = await boot();
    const release = holdRequest(api, "createTask");

    const creating = createTask({ title: "Race me" });
    const taskId = Object.keys(tasksOf())[0];
    const completing = toggleComplete(taskId);
    release();

    expect(await creating).toBeTruthy();
    expect(await completing).toBe(true);
    expect(notice()).toBeNull();
    expect(tasksOf()[taskId].completed).toBe(true);
    expect(api.data.tasks.find((task) => task.id === taskId).completed).toBe(true);
  });

  it("does not let insert confirmation overwrite a newer optimistic edit", async () => {
    const api = await boot();
    const release = holdRequest(api, "createTask");

    const creating = createTask({ title: "First title" });
    const taskId = Object.keys(tasksOf())[0];
    const editing = updateTask(taskId, { title: "Newer title" });
    release();

    expect(await creating).toBeTruthy();
    expect(tasksOf()[taskId].title).toBe("Newer title");
    expect(await editing).toBe(true);
    expect(api.data.tasks.find((task) => task.id === taskId).title).toBe(
      "Newer title"
    );
  });

  it("restores a confirmed insert if an older list snapshot removed its row", async () => {
    const api = await boot();
    const release = holdRequest(api, "createTask");

    const creating = createTask({ title: "Keep me" });
    const taskId = Object.keys(tasksOf())[0];
    // A list replacement is not a user deletion and therefore does not mark
    // this task as a newer local write.
    setState({ tasks: {} });
    release();

    expect(await creating).toMatchObject({ id: taskId, title: "Keep me" });
    expect(tasksOf()[taskId].title).toBe("Keep me");
  });

  it("assigns the new task when the composer picked someone", async () => {
    const api = await boot();

    const created = await createTask({
      title: "Draft copy",
      projectId: "project-1",
      assigneeId: "user-2",
    });

    expect(created.assigneeId).toBe("user-2");
    expect(api.callsOf("setAssignee")).toEqual([[created.id, "user-2"]]);
  });

  it("refuses an empty title and a too-long description without calling the api", async () => {
    const api = await boot();

    expect(await createTask({ title: "   " })).toBeNull();
    expect(notice().text).toBe("Task title cannot be empty.");

    expect(
      await createTask({ title: "Long", description: "x".repeat(1001) })
    ).toBeNull();
    expect(notice().text).toBe(
      "Task descriptions must be 1,000 characters or fewer."
    );
    expect(api.callCount("createTask")).toBe(0);
    expect(tasksOf()).toEqual({});
  });

  it("removes the optimistic task when the server rejects it", async () => {
    const api = await boot();
    api.failNext("createTask", new Error("offline"));

    expect(await createTask({ title: "Doomed" })).toBeNull();
    expect(tasksOf()).toEqual({});
    expect(notice().text).toBe(
      "We couldn't create this task. Check your connection and try again."
    );
  });
});

describe("updateTask", () => {
  it("completes a task immediately and clears completedAt when it is reopened", async () => {
    await boot({ tasks: [makeTask({ id: "task-1", title: "Buy milk" })] });

    const completing = toggleComplete("task-1");
    expect(tasksOf()["task-1"]).toMatchObject({ completed: true, status: "completed" });
    expect(tasksOf()["task-1"].completedAt).toBeTruthy();
    await completing;

    await toggleComplete("task-1");
    expect(tasksOf()["task-1"]).toMatchObject({
      completed: false,
      status: "todo",
      completedAt: null,
    });
  });

  it("rolls back only the fields it patched and explains what happened", async () => {
    const api = await boot({
      tasks: [makeTask({ id: "task-1", title: "Buy milk", priority: "high" })],
    });
    api.failNext("updateTask", new Error("offline"));

    expect(await updateTask("task-1", { title: "Buy oat milk" })).toBe(false);
    expect(tasksOf()["task-1"]).toMatchObject({
      title: "Buy milk",
      priority: "high",
    });
    expect(notice()).toMatchObject({ tone: "error", text: "We couldn't save your changes." });
  });

  it("serializes two rapid edits and keeps the newest value on screen", async () => {
    const api = await boot({ tasks: [makeTask({ id: "task-1", title: "First" })] });

    const first = updateTask("task-1", { title: "Second" });
    const second = updateTask("task-1", { title: "Third" });
    expect(tasksOf()["task-1"].title).toBe("Third");

    await first;
    // The first response must not resurrect "Second" over the newer edit.
    expect(tasksOf()["task-1"].title).toBe("Third");
    await second;

    expect(api.callsOf("updateTask").map(([, patch]) => patch.title)).toEqual([
      "Second",
      "Third",
    ]);
    expect(tasksOf()["task-1"].title).toBe("Third");
    expect(getState().pending["task-1"]).toBeUndefined();
  });

  it("restores the original value when two rapid edits both fail", async () => {
    const api = await boot({ tasks: [makeTask({ id: "task-1", title: "First" })] });
    api.failNext("updateTask", new Error("first failed"));
    api.failNext("updateTask", new Error("second failed"));

    const first = updateTask("task-1", { title: "Second" });
    const second = updateTask("task-1", { title: "Third" });
    expect(tasksOf()["task-1"].title).toBe("Third");

    expect(await first).toBe(false);
    expect(tasksOf()["task-1"].title).toBe("Third");
    expect(await second).toBe(false);
    expect(tasksOf()["task-1"].title).toBe("First");
  });

  it("moves a project task to the column its new status belongs to", async () => {
    await boot({
      tasks: [
        makeTask({
          id: "task-1",
          projectId: "project-1",
          columnId: "column-todo",
          position: 0,
        }),
      ],
    });
    await ensureWorkspace("project-1");

    expect(await updateTask("task-1", { status: "completed" })).toBe(true);
    expect(tasksOf()["task-1"]).toMatchObject({
      status: "completed",
      completed: true,
      columnId: "column-done",
      position: 0,
    });
  });

  it("leaves the board position alone outside the project's workspace", async () => {
    // Ticking a project task off from My Tasks must not renumber a board this
    // session has never loaded.
    const api = await boot({
      tasks: [
        makeTask({
          id: "task-1",
          projectId: "project-1",
          columnId: "column-todo",
          position: 4,
          assigneeId: user.id,
        }),
      ],
    });

    expect(await toggleComplete("task-1")).toBe(true);

    const [, patch] = api.callsOf("updateTask")[0];
    expect(patch.columnId).toBe("column-done");
    expect(patch).not.toHaveProperty("position");
    expect(tasksOf()["task-1"].position).toBe(4);
  });

  it("reports a schedule the database would reject", async () => {
    const api = await boot({ tasks: [makeTask({ id: "task-1" })] });

    expect(await updateTask("task-1", { endDate: "2026-03-04" })).toBe(false);
    expect(notice().text).toMatch(/start date/i);
    expect(api.callCount("updateTask")).toBe(0);
  });

  it("disables an existing reminder when its delivery time is cleared", async () => {
    const api = await boot({
      tasks: [
        makeTask({
          id: "task-1",
          reminder: true,
          reminderAt: "2099-03-04T08:45:00.000Z",
        }),
      ],
    });

    expect(await updateTask("task-1", { reminderAt: "" })).toBe(true);

    expect(tasksOf()["task-1"]).toMatchObject({ reminder: false, reminderAt: "" });
    expect(api.callsOf("updateTask")[0][1]).toMatchObject({
      reminder: false,
      reminderAt: "",
    });
  });

  it("clears project-owned placement and assignment when moving projects", async () => {
    const secondColumn = makeColumn({
      id: "column-2-todo",
      projectId: "project-2",
      category: "todo",
      position: 0,
    });
    const api = await boot({
      projects: [
        makeProject({ id: "project-1", ownerId: user.id }),
        makeProject({ id: "project-2", ownerId: user.id }),
      ],
      columns: [...columns, secondColumn],
      members: [
        {
          projectId: "project-1",
          userId: user.id,
          role: "owner",
          displayName: "Sam Rivera",
        },
        {
          projectId: "project-2",
          userId: user.id,
          role: "owner",
          displayName: "Sam Rivera",
        },
      ],
      tasks: [
        makeTask({
          id: "task-1",
          projectId: "project-1",
          storyId: "story-old",
          columnId: "column-todo",
          position: 7,
          assigneeId: user.id,
        }),
      ],
    });

    expect(await updateTask("task-1", { projectId: "project-2" })).toBe(true);

    expect(tasksOf()["task-1"]).toMatchObject({
      projectId: "project-2",
      storyId: null,
      columnId: "column-2-todo",
      position: null,
      assigneeId: null,
    });
    expect(api.callsOf("setAssignee")).toContainEqual(["task-1", null]);
  });
});

describe("archiveTask and restoreTask", () => {
  it("archives a task and restores it", async () => {
    await boot({ tasks: [makeTask({ id: "task-1", title: "Buy milk" })] });

    expect(await archiveTask("task-1")).toBe(true);
    expect(tasksOf()["task-1"].archivedAt).toBeTruthy();

    expect(await restoreTask("task-1")).toBe(true);
    expect(tasksOf()["task-1"].archivedAt).toBeNull();
  });

  it("refuses to archive a story with linked tasks until they are unlinked", async () => {
    const api = await boot({
      tasks: [
        makeTask({ id: "story-1", projectId: "project-1", workType: "story", title: "Launch" }),
        makeTask({
          id: "task-1",
          projectId: "project-1",
          storyId: "story-1",
          assigneeId: user.id,
        }),
      ],
    });
    await ensureWorkspace("project-1");

    expect(await archiveTask("story-1")).toBe(false);
    expect(tasksOf()["story-1"].archivedAt).toBeNull();
    expect(notice().text).toBe(
      "Move linked tasks to No story before archiving this story."
    );
    expect(api.callCount("updateTask")).toBe(0);

    expect(
      await archiveTask("story-1", { moveLinkedTasksToUncategorized: true })
    ).toBe(true);
    expect(tasksOf()["task-1"].storyId).toBeNull();
    expect(tasksOf()["story-1"].archivedAt).toBeTruthy();
  });
});

describe("deleteTask", () => {
  it("removes a project task's attachments before the task itself", async () => {
    const api = await boot({
      tasks: [makeTask({ id: "task-1", projectId: "project-1", assigneeId: user.id })],
      attachments: [
        {
          id: "attachment-1",
          projectId: "project-1",
          entityType: "task",
          entityId: "task-1",
        },
      ],
    });

    expect(await deleteTask("task-1")).toBe(true);
    expect(tasksOf()["task-1"]).toBeUndefined();
    expect(api.data.attachments).toEqual([]);
    expect(
      api.calls
        .map(([name]) => name)
        .filter((name) => name === "removeAllAttachments" || name === "deleteTask")
    ).toEqual(["removeAllAttachments", "deleteTask"]);
  });

  it("puts the task back when the delete fails", async () => {
    const api = await boot({ tasks: [makeTask({ id: "task-1", title: "Buy milk" })] });
    api.failNext("deleteTask", new Error("offline"));

    expect(await deleteTask("task-1")).toBe(false);
    expect(tasksOf()["task-1"].title).toBe("Buy milk");
    expect(notice().text).toBe(
      "We couldn't delete this task. Check your connection and try again."
    );
  });
});

describe("moveTasks", () => {
  const boardSeed = {
    tasks: [
      makeTask({
        id: "task-1",
        projectId: "project-1",
        columnId: "column-todo",
        position: 0,
        assigneeId: user.id,
      }),
      makeTask({
        id: "task-2",
        projectId: "project-1",
        columnId: "column-todo",
        position: 1,
        assigneeId: user.id,
      }),
    ],
  };

  it("applies the drop immediately and derives the status from the column", async () => {
    const api = await boot(boardSeed);

    const moving = moveTasks("project-1", [
      { taskId: "task-1", columnId: "column-done", position: 0 },
      { taskId: "task-2", columnId: "column-todo", position: 0 },
    ]);
    expect(tasksOf()["task-1"]).toMatchObject({
      columnId: "column-done",
      position: 0,
      status: "completed",
      completed: true,
    });
    expect(tasksOf()["task-1"].completedAt).toBeTruthy();

    expect(await moving).toBe(true);
    expect(api.callsOf("reorderTasks")[0][0]).toHaveLength(2);
  });

  it("keeps a drop that lands while an edit is still on the wire", async () => {
    const api = await boot(boardSeed);
    await ensureWorkspace("project-1");
    const release = holdResponse(api, "updateTask");

    const editing = updateTask("task-1", { title: "Renamed" });
    const moving = moveTasks("project-1", [
      { taskId: "task-1", columnId: "column-done", position: 0 },
    ]);
    release();

    expect(await editing).toBe(true);
    expect(await moving).toBe(true);
    // The edit's response carried the pre-move column; it must not undo the drop.
    expect(tasksOf()["task-1"]).toMatchObject({
      title: "Renamed",
      columnId: "column-done",
      status: "completed",
    });
    expect(api.data.tasks.find((task) => task.id === "task-1").columnId).toBe(
      "column-done"
    );
  });

  it("restores the pre-edit placement when an edit and its queued move both fail", async () => {
    const api = await boot(boardSeed);
    api.failNext("updateTask", new Error("edit failed"));
    api.failNext("reorderTasks", new Error("move failed"));

    const editing = updateTask("task-1", { status: "in-progress" });
    const moving = moveTasks("project-1", [
      { taskId: "task-1", columnId: "column-done", position: 0 },
    ]);

    expect(await editing).toBe(false);
    expect(tasksOf()["task-1"].status).toBe("completed");
    expect(await moving).toBe(false);
    expect(tasksOf()["task-1"]).toMatchObject({
      columnId: "column-todo",
      position: 0,
      status: "todo",
      completed: false,
    });
  });

  it("restores the board when the reorder fails", async () => {
    const api = await boot(boardSeed);
    api.failNext("reorderTasks", new Error("offline"));

    expect(
      await moveTasks("project-1", [
        { taskId: "task-1", columnId: "column-done", position: 0 },
      ])
    ).toBe(false);
    expect(tasksOf()["task-1"]).toMatchObject({
      columnId: "column-todo",
      position: 0,
      status: "todo",
    });
    expect(notice().text).toBe(
      "We couldn't save that task move. The board has been restored."
    );
  });

  it("normalizes an invalid negative placement before storing or sending it", async () => {
    const api = await boot(boardSeed);

    expect(
      await moveTasks("project-1", [
        { taskId: "task-1", columnId: "column-todo", position: -3 },
      ])
    ).toBe(true);

    expect(tasksOf()["task-1"].position).toBe(0);
    expect(api.callsOf("reorderTasks")[0][0][0].position).toBe(0);
  });
});

describe("setAssignee", () => {
  it("assigns and rolls back on failure", async () => {
    const api = await boot({
      tasks: [makeTask({ id: "task-1", projectId: "project-1", assigneeId: user.id })],
    });

    expect(await setAssignee("task-1", "user-2")).toBe(true);
    expect(tasksOf()["task-1"].assigneeId).toBe("user-2");

    api.failNext("setAssignee", new Error("offline"));
    expect(await setAssignee("task-1", null)).toBe(false);
    expect(tasksOf()["task-1"].assigneeId).toBe("user-2");
    expect(notice().text).toBe("We couldn't update this task's assignee.");
  });
});

describe("bulkUpdate", () => {
  const bulkSeed = {
    tasks: [
      makeTask({ id: "task-1", projectId: "project-1", assigneeId: user.id }),
      makeTask({ id: "task-2", projectId: "project-1", assigneeId: user.id }),
    ],
  };

  it("reports exactly which tasks failed", async () => {
    const api = await boot(bulkSeed);
    api.failNext("updateTask", new Error("permission denied"));

    const result = await bulkUpdate(["task-1", "task-2"], {
      type: "priority",
      value: "high",
    });

    expect(result).toEqual({ updated: 1, failed: 1, failedIds: ["task-1"] });
    expect(tasksOf()["task-1"].priority).toBe("medium");
    expect(tasksOf()["task-2"].priority).toBe("high");
  });

  it("reassigns every selected task", async () => {
    await boot(bulkSeed);

    const result = await bulkUpdate(["task-1", "task-2"], {
      type: "assignee",
      value: "user-2",
    });

    expect(result).toMatchObject({ updated: 2, failed: 0 });
    expect(tasksOf()["task-1"].assigneeId).toBe("user-2");
    expect(tasksOf()["task-2"].assigneeId).toBe("user-2");
  });

  it("rejects an action the workspace does not offer", async () => {
    const api = await boot(bulkSeed);

    expect(await bulkUpdate(["task-1"], { type: "status", value: "blocked" })).toEqual({
      updated: 0,
      failed: 0,
      failedIds: [],
    });
    expect(notice().text).toBe("Choose a valid task status.");
    expect(api.callCount("updateTask")).toBe(0);
  });
});
