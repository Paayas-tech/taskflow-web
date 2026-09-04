/**
 * Project actions: the lazily loaded project workspaces, project CRUD,
 * invitations and the members roster. A workspace is fetched the first time it
 * is opened and served from the store afterwards; revisiting it after
 * `WORKSPACE_STALE_MS` triggers one silent background revalidation.
 */
import { normalizeProjectHealth } from "../domain/task";
import { loadProjects, loadTasks } from "./session";
import {
  api,
  getState,
  isCurrentSession,
  onStoreReset,
  sessionStamp,
  setState,
} from "./store";
import { writeStamp, writtenSince } from "./tasks";
import { notify } from "./ui";

export const WORKSPACE_STALE_MS = 60_000;

const WORKSPACE_LOAD_ERROR =
  "We couldn't load this project workspace. Check your connection and try again.";
const CREATE_ERROR =
  "We couldn't create this project. Check your connection and try again.";
const SAVE_ERROR =
  "We couldn't save this project. Check your connection and try again.";
const DELETE_ERROR =
  "We couldn't delete this project. Check your connection and try again.";
const INVITATION_ERROR = "We couldn't update this invitation. Try again.";
const MEMBERS_ERROR = "We couldn't load this project roster. Try again.";
const SIGNED_OUT_ERROR = "You must be signed in to change a project.";

const nowIso = () => new Date().toISOString();

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const inflight = new Map();

/** The store was reset (sign-out, a fresh test): no load in flight still counts. */
onStoreReset(() => inflight.clear());

/* -------------------------------------------------------------------------
 * Store writes
 * ---------------------------------------------------------------------- */

const without = (map, key) => {
  const next = { ...map };
  delete next[key];
  return next;
};

const putProject = (project) =>
  setState((state) => ({
    projects: { ...state.projects, [project.id]: project },
  }));

const patchProject = (projectId, patch) =>
  setState((state) => {
    const project = state.projects[projectId];
    if (!project) return null;
    return {
      projects: { ...state.projects, [projectId]: { ...project, ...patch } },
    };
  });

/** Forgets a project and everything the store keeps keyed by it. */
const dropProject = (projectId) =>
  setState((state) => {
    const tasks = {};
    const attachmentCounts = { ...state.attachmentCounts };
    Object.entries(state.tasks).forEach(([taskId, task]) => {
      if (task.projectId === projectId) delete attachmentCounts[taskId];
      else tasks[taskId] = task;
    });

    return {
      projects: without(state.projects, projectId),
      columns: without(state.columns, projectId),
      members: without(state.members, projectId),
      tasks,
      attachmentCounts,
      workspaceLoadedAt: without(state.workspaceLoadedAt, projectId),
      loaded: {
        ...state.loaded,
        workspaces: without(state.loaded.workspaces, projectId),
      },
    };
  });

const setWorkspaceStatus = (projectId, status, error = "") =>
  setState((state) => ({
    loaded: {
      ...state.loaded,
      workspaces: { ...state.loaded.workspaces, [projectId]: status },
    },
    errors: {
      ...state.errors,
      workspaces: { ...state.errors.workspaces, [projectId]: error },
    },
  }));

/**
 * Replaces every stored task of one project with the rows just fetched, except
 * the ones written locally after the request went out: the board stays usable
 * during a silent revalidation, and this response predates those writes.
 */
const mergeProjectTasks = (projectId, list, stamp) =>
  setState((state) => {
    const tasks = {};
    Object.entries(state.tasks).forEach(([taskId, task]) => {
      if (task.projectId !== projectId || writtenSince(taskId, stamp)) {
        tasks[taskId] = task;
      }
    });
    list.forEach((task) => {
      if (writtenSince(task.id, stamp)) return;
      tasks[task.id] = { ...state.tasks[task.id], ...task };
    });
    return { tasks };
  });

export const setAttachmentCount = (taskId, count) =>
  setState((state) => ({
    attachmentCounts: { ...state.attachmentCounts, [taskId]: count || 0 },
  }));

/* -------------------------------------------------------------------------
 * Workspaces
 * ---------------------------------------------------------------------- */

const ensureColumns = async (projectId) => {
  const session = sessionStamp();
  const state = getState();
  if ((state.columns[projectId] || []).length > 0) return;
  const role = state.projects[projectId]?.viewerRole;
  if (role !== "owner" && role !== "editor") return;

  try {
    const columns = await api().createDefaultColumns(projectId);
    if (columns?.length && isCurrentSession(session)) {
      setState((current) => ({
        columns: { ...current.columns, [projectId]: columns },
      }));
    }
  } catch {
    // A workspace without columns still lists its tasks.
  }
};

const loadWorkspace = async (projectId, silent) => {
  const session = sessionStamp();
  if (!silent) setWorkspaceStatus(projectId, "loading");
  // Everything written locally from here on is newer than this response.
  const stamp = writeStamp();

  try {
    const [tasks, attachmentCounts] = await Promise.all([
      api().listProjectTasks(projectId),
      // Counts are decoration: a workspace still opens without them.
      api().listTaskAttachmentCounts(projectId).catch(() => ({})),
    ]);
    // Signed out (or switched accounts) while this was on the wire.
    if (!isCurrentSession(session)) return;

    mergeProjectTasks(projectId, tasks, stamp);
    setState((state) => ({
      attachmentCounts: { ...state.attachmentCounts, ...attachmentCounts },
    }));
    await ensureColumns(projectId);
    if (!isCurrentSession(session)) return;

    setState((state) => ({
      workspaceLoadedAt: { ...state.workspaceLoadedAt, [projectId]: Date.now() },
    }));
    setWorkspaceStatus(projectId, "ready");
  } catch {
    // A silent revalidation keeps the data (and the status) already on screen.
    if (!silent && isCurrentSession(session)) {
      setWorkspaceStatus(projectId, "error", WORKSPACE_LOAD_ERROR);
    }
  }
};

/**
 * Loads a project's tasks and attachment counts the first time it is opened.
 * A second call while the workspace is ready and fresh makes no request.
 */
export const ensureWorkspace = (projectId) => {
  if (!projectId) return Promise.resolve();

  const running = inflight.get(projectId);
  if (running) return running;

  const state = getState();
  const status = state.loaded.workspaces[projectId] || "idle";
  const fresh =
    Date.now() - (state.workspaceLoadedAt[projectId] || 0) < WORKSPACE_STALE_MS;
  if (status === "ready" && fresh) return Promise.resolve();

  let promise;
  promise = loadWorkspace(projectId, status === "ready").finally(() => {
    // A reset can start a new account's load for the same project before this
    // old promise settles. Only clear the entry this call installed.
    if (inflight.get(projectId) === promise) inflight.delete(projectId);
  });
  inflight.set(projectId, promise);
  return promise;
};

/* -------------------------------------------------------------------------
 * Project CRUD
 * ---------------------------------------------------------------------- */

const validateProjectFields = (values) => {
  const patch = {};
  if (hasOwn(values, "name")) {
    patch.name = String(values.name || "").trim();
    if (!patch.name) throw new Error("Project name cannot be empty.");
  }
  if (hasOwn(values, "description")) {
    patch.description = String(values.description || "");
    if (patch.description.length > 1000) {
      throw new Error("Project descriptions must be 1,000 characters or fewer.");
    }
  }
  if (hasOwn(values, "color")) patch.color = String(values.color || "");
  if (hasOwn(values, "dueDate")) patch.dueDate = values.dueDate || "";
  if (hasOwn(values, "status")) {
    patch.status = values.status === "archived" ? "archived" : "active";
    patch.archivedAt = patch.status === "archived" ? nowIso() : null;
  }
  if (hasOwn(values, "healthStatus")) {
    patch.healthStatus = normalizeProjectHealth(values.healthStatus);
  }
  return patch;
};

export const createProject = async (values = {}) => {
  const { auth } = getState();
  if (!auth.user) {
    notify({ tone: "error", text: SIGNED_OUT_ERROR });
    return null;
  }
  const session = sessionStamp();

  let fields;
  try {
    fields = validateProjectFields({ name: "", description: "", ...values });
  } catch (error) {
    notify({ tone: "error", text: error.message });
    return null;
  }

  const createdAt = nowIso();
  const project = {
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    name: fields.name,
    description: fields.description,
    color: fields.color || "",
    status: "active",
    healthStatus: "on_track",
    dueDate: fields.dueDate || "",
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    viewerRole: "owner",
  };
  putProject(project);

  try {
    const saved = await api().createProject(project);
    if (!isCurrentSession(session)) return null;
    if (saved) {
      putProject({ ...project, ...saved, viewerRole: saved.viewerRole || "owner" });
    }
  } catch {
    if (!isCurrentSession(session)) return null;
    dropProject(project.id);
    notify({ tone: "error", text: CREATE_ERROR });
    return null;
  }

  // The project's default columns and its owner membership are created by the
  // api and by a database trigger; read them back so the workspace is usable.
  try {
    const [columns, members] = await Promise.all([
      api().listColumns(project.id),
      api().listMembers(project.id),
    ]);
    if (!isCurrentSession(session)) return null;
    setState((state) => ({
      columns: { ...state.columns, [project.id]: columns || [] },
      members: { ...state.members, [project.id]: members || [] },
    }));
  } catch {
    // The workspace fills these in on its first open.
  }

  if (!isCurrentSession(session)) return null;
  return getState().projects[project.id] || null;
};

export const updateProject = async (projectId, values = {}) => {
  const session = sessionStamp();
  const project = getState().projects[projectId];
  if (!project) return false;

  let patch;
  try {
    patch = validateProjectFields(values);
  } catch (error) {
    notify({ tone: "error", text: error.message });
    return false;
  }
  if (Object.keys(patch).length === 0) return true;

  const previous = Object.fromEntries(
    Object.keys(patch).map((key) => [key, project[key]])
  );
  patchProject(projectId, patch);

  try {
    const saved = await api().updateProject(projectId, patch);
    if (!isCurrentSession(session)) return false;
    if (saved) patchProject(projectId, saved);
    return true;
  } catch {
    if (!isCurrentSession(session)) return false;
    patchProject(projectId, previous);
    notify({ tone: "error", text: SAVE_ERROR });
    return false;
  }
};

export const deleteProject = async (projectId) => {
  const session = sessionStamp();
  const state = getState();
  const project = state.projects[projectId];
  if (!project) return false;

  const columns = state.columns[projectId] || [];
  const members = state.members[projectId] || [];
  const tasks = Object.values(state.tasks).filter(
    (task) => task.projectId === projectId
  );
  dropProject(projectId);

  try {
    // Storage objects do not cascade with the project row, so every file the
    // project owns is cleared first; a failure here leaves the project alone.
    await api().removeAllAttachments({
      projectId,
      entityType: "project",
      entityId: projectId,
    });
    await api().deleteProject(projectId);
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    setState((current) => ({
      projects: { ...current.projects, [projectId]: project },
      columns: { ...current.columns, [projectId]: columns },
      members: { ...current.members, [projectId]: members },
      tasks: {
        ...current.tasks,
        ...Object.fromEntries(tasks.map((task) => [task.id, task])),
      },
    }));
    notify({ tone: "error", text: DELETE_ERROR });
    return false;
  }
};

/** Health is owned by a database function; the store mirrors it optimistically. */
export const setProjectHealth = (projectId, healthStatus) =>
  updateProject(projectId, { healthStatus });

/* -------------------------------------------------------------------------
 * Invitations and members
 * ---------------------------------------------------------------------- */

/** Drops the invitation from the list immediately, putting it back on failure. */
const respond = async (invitationId, response) => {
  const session = sessionStamp();
  const previous = getState().invitations;
  setState({
    invitations: previous.filter(
      (invitation) => invitation.id !== invitationId
    ),
  });

  try {
    await api().respondToInvitation(invitationId, response);
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    setState({ invitations: previous });
    notify({ tone: "error", text: INVITATION_ERROR });
    return false;
  }
};

/**
 * Accepting quietly reloads projects and tasks: the new project — and any task
 * already assigned to me in it — appears without a skeleton.
 */
export const acceptInvitation = async (invitationId) => {
  if (!(await respond(invitationId, "accepted"))) return false;

  await Promise.allSettled([
    loadProjects({ silent: true }),
    loadTasks({ silent: true }),
  ]);
  return true;
};

export const declineInvitation = (invitationId) =>
  respond(invitationId, "declined");

/** Re-reads one project's roster after an invite, role change or removal. */
export const refreshMembers = async (projectId) => {
  const session = sessionStamp();
  try {
    const members = await api().listMembers(projectId);
    if (!isCurrentSession(session)) return null;
    setState((state) => {
      const profiles = { ...state.profiles };
      members.forEach((member) => {
        profiles[member.userId] = {
          displayName: member.displayName || "",
          avatarUrl: member.avatarUrl || "",
        };
      });
      return { members: { ...state.members, [projectId]: members }, profiles };
    });
    return members;
  } catch {
    if (!isCurrentSession(session)) return null;
    notify({ tone: "error", text: MEMBERS_ERROR });
    return null;
  }
};
