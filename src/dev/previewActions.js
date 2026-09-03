/**
 * Fake action objects for the dev preview harness (`/__preview`).
 *
 * Everything resolves after a short delay and mutates the in-memory fixture
 * state, so completing, editing, archiving and creating tasks all behave like
 * the real app without a backend. Dev-only: see `src/dev/fixtures.js`.
 */

import { isTaskComplete, normalizeTaskDocument } from "../domain/taskDomain";
import { columns, members } from "./fixtures";

/** Every preview mutation resolves after this many milliseconds. */
export const PREVIEW_LATENCY = 300;

export const delay = (ms = PREVIEW_LATENCY) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

let createdCount = 0;
const generateId = (prefix) => `${prefix}-preview-${++createdCount}`;

const withId = (set, id) => {
  const next = new Set(set);
  next.add(id);
  return next;
};

const withoutId = (set, id) => {
  const next = new Set(set);
  next.delete(id);
  return next;
};

const patchList = (list, taskId, patch) =>
  list.map((task) => (task.id === taskId ? { ...task, ...patch } : task));

const dropFromList = (list, taskId) => list.filter((task) => task.id !== taskId);

const memberName = (assigneeId) =>
  members.find((member) => member.userId === assigneeId)?.displayName || "";

const completionPatch = (task) => {
  const completed = !isTaskComplete(task);
  return {
    completed,
    status: completed ? "completed" : "todo",
    completedAt: completed ? new Date().toISOString() : null,
  };
};

/**
 * The `taskActions` object from §7.2, backed by fixture state. `state` is the
 * current preview state (for `pendingIds`); `setState` is its React setter.
 */
export function createPreviewTaskActions(state, setState) {
  const runMutation = async (taskId, apply) => {
    setState((current) => ({ ...current, pendingIds: withId(current.pendingIds, taskId) }));
    await delay();
    setState((current) => ({
      ...apply(current),
      pendingIds: withoutId(current.pendingIds, taskId),
    }));
  };

  const applyPatch = (task, patch) =>
    runMutation(task.id, (current) => ({
      ...current,
      tasks: patchList(current.tasks, task.id, patch),
      projectTasks: patchList(current.projectTasks, task.id, patch),
    }));

  const appendTask = async (values, projectId) => {
    const id = generateId(values.workType === "story" ? "story" : "task");
    const now = new Date().toISOString();
    const created = {
      ...normalizeTaskDocument(id, {
        status: "todo",
        priority: "medium",
        ...values,
        projectId: projectId || null,
        createdAt: now,
        updatedAt: now,
      }),
      assigneeId: values.assigneeId || null,
      assigneeName: values.assigneeId ? memberName(values.assigneeId) : "",
      storyName: "",
      columnId: null,
      position: 0,
      attachmentCount: 0,
    };

    await delay();
    setState((current) => ({
      ...current,
      tasks: [created, ...current.tasks],
      projectTasks: projectId ? [created, ...current.projectTasks] : current.projectTasks,
    }));
    return { id };
  };

  return {
    pendingIds: state.pendingIds,
    update: (task, patch) => applyPatch(task, patch),
    quickUpdate: (task, patch) => applyPatch(task, patch),
    toggleComplete: (task) => applyPatch(task, completionPatch(task)),
    archive: (task) => applyPatch(task, { archivedAt: new Date().toISOString() }),
    restore: (task) => applyPatch(task, { archivedAt: null }),
    remove: (task) =>
      runMutation(task.id, (current) => ({
        ...current,
        tasks: dropFromList(current.tasks, task.id),
        projectTasks: dropFromList(current.projectTasks, task.id),
      })),
    setAssignee: (task, assigneeId) =>
      applyPatch(task, {
        assigneeId: assigneeId || null,
        assigneeName: assigneeId ? memberName(assigneeId) : "",
      }),
    createPersonal: (values = {}) => appendTask(values, null),
    createInProject: (projectId, values = {}) => appendTask(values, projectId),
  };
}

/**
 * A `workspaceLoader` for `ProjectWorkspacePage`. `getState` keeps the loader
 * referentially stable (the page reloads whenever the loader identity changes).
 */
export const createPreviewWorkspaceLoader = (getState) => async (_userId, projectId) => {
  await delay();
  const state = getState();
  const pool = [...state.projectTasks, ...state.tasks];
  const seen = new Set();
  const projectTasks = pool.filter((task) => {
    if (task.projectId !== projectId || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });

  return {
    tasks: projectTasks,
    columns: columns.map((column) => ({ ...column, projectId })),
    members,
  };
};

/** Inbox handlers: mark read, mark all read, dismiss and refresh. */
export function createPreviewNotificationActions(setState) {
  const patchNotifications = async (apply) => {
    await delay();
    setState((current) => ({ ...current, notifications: apply(current.notifications) }));
  };

  return {
    markRead: (id) =>
      patchNotifications((list) =>
        list.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item
        )
      ),
    markAllRead: () =>
      patchNotifications((list) =>
        list.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() }))
      ),
    dismiss: (id) => patchNotifications((list) => list.filter((item) => item.id !== id)),
    refresh: () => {
      void patchNotifications((list) => [...list]);
    },
  };
}

/** Accepting or declining the fixture invitation removes it from the list. */
export function createPreviewInvitationActions(setState) {
  const resolveInvitation = async (invitation) => {
    await delay();
    setState((current) => ({
      ...current,
      invitations: current.invitations.filter((item) => item.id !== invitation.id),
    }));
  };

  return {
    accept: resolveInvitation,
    decline: resolveInvitation,
  };
}

/** Project create/update/delete against the fixture project list. */
export function createPreviewProjectActions(setState) {
  return {
    create: async (values = {}) => {
      const id = generateId("project");
      const now = new Date().toISOString();
      const project = {
        id,
        ownerId: "preview-user",
        name: values.name || "Untitled project",
        description: values.description || "",
        color: values.color || "#5b5bd6",
        status: "active",
        dueDate: "",
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        viewerRole: "owner",
      };
      await delay();
      setState((current) => ({ ...current, projects: [...current.projects, project] }));
      return project;
    },
    update: async (projectId, values = {}) => {
      await delay();
      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? { ...project, ...values, updatedAt: new Date().toISOString() }
            : project
        ),
      }));
    },
    remove: async (projectId) => {
      await delay();
      setState((current) => ({
        ...current,
        projects: current.projects.filter((project) => project.id !== projectId),
      }));
    },
  };
}
