/**
 * Session lifecycle: one parallel load of everything a signed-in person can
 * see, the realtime notification subscription, silent revalidation and the
 * bridge from `api/auth` events to the store.
 */
import {
  api,
  getState,
  isCurrentSession,
  resetStore,
  sessionStamp,
  setState,
} from "./store";
import { loadNotifications } from "./notifications";
import { cancelRememberLastViewed } from "./settings";
import { writeStamp, writtenSince } from "./tasks";
import { clearNotice, navigate } from "./ui";

export const REVALIDATE_MS = 60_000;

const TASKS_ERROR =
  "We couldn't load your tasks. Check your connection and try again.";
const PROJECTS_ERROR =
  "We couldn't load your projects. Check your connection and try again.";
const INVITATIONS_ERROR = "We couldn't load your project invitations. Try again.";
const SETTINGS_ERROR =
  "We couldn't load your saved settings. Safe defaults are active.";

let notificationsUnsubscribe = null;

const setSlice = (slice, status, error = "") =>
  setState((state) => ({
    loaded: { ...state.loaded, [slice]: status },
    errors: { ...state.errors, [slice]: error },
  }));

const byPosition = (first, second) => (first.position ?? 0) - (second.position ?? 0);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

/**
 * Applies a server snapshot while retaining keys that were added, changed or
 * removed locally after the request began.
 */
const mergeConcurrentMapChanges = (before, current, incoming) => {
  const merged = { ...incoming };
  new Set([...Object.keys(before), ...Object.keys(current)]).forEach((key) => {
    if (before[key] === current[key]) return;
    if (hasOwn(current, key)) merged[key] = current[key];
    else delete merged[key];
  });
  return merged;
};

const indexById = (items) =>
  Object.fromEntries(items.map((item) => [item.id, item]));

/** The list equivalent of `mergeConcurrentMapChanges`, preserving its order. */
const mergeConcurrentListChanges = (before, current, incoming) => {
  const merged = mergeConcurrentMapChanges(
    indexById(before),
    indexById(current),
    indexById(incoming)
  );
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [
    ...incoming.map((item) => merged[item.id]).filter(Boolean),
    ...current.filter((item) => !incomingIds.has(item.id) && merged[item.id]),
  ];
};

/* -------------------------------------------------------------------------
 * Core loads
 * ---------------------------------------------------------------------- */

/** Projects, every column and every membership I can see, in one round. */
export const loadProjects = async ({ silent = false } = {}) => {
  const session = sessionStamp();
  const user = getState().auth.user;
  if (!user) return null;
  if (!silent) setSlice("projects", "loading");
  const projectsAtStart = getState().projects;
  const columnsAtStart = getState().columns;
  const membersAtStart = getState().members;

  try {
    const [projects, columns, members] = await Promise.all([
      api().listProjects(user.id),
      api().listAllColumns(),
      api().listAllMembers(),
    ]);
    // Signed out (or switched accounts) while this was on the wire.
    if (!isCurrentSession(session)) return null;

    const projectsById = {};
    projects.forEach((project) => {
      projectsById[project.id] = project;
    });

    const columnsByProject = {};
    [...columns]
      .sort(byPosition)
      .forEach((column) => {
        (columnsByProject[column.projectId] ||= []).push(column);
      });

    const membersByProject = {};
    const profiles = {};
    members.forEach((member) => {
      (membersByProject[member.projectId] ||= []).push(member);
      profiles[member.userId] = {
        displayName: member.displayName || "",
        avatarUrl: member.avatarUrl || "",
      };
    });

    setState((state) => ({
      // A project mutation may have landed while these three requests were in
      // flight. Preserve every key whose local reference changed (including a
      // newly added or deleted key) instead of replacing it with this older
      // snapshot.
      projects: mergeConcurrentMapChanges(
        projectsAtStart,
        state.projects,
        projectsById
      ),
      columns: mergeConcurrentMapChanges(
        columnsAtStart,
        state.columns,
        columnsByProject
      ),
      members: mergeConcurrentMapChanges(
        membersAtStart,
        state.members,
        membersByProject
      ),
      profiles: { ...state.profiles, ...profiles },
    }));
    setSlice("projects", "ready");
    return projects;
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!silent) setSlice("projects", "error", PROJECTS_ERROR);
    return null;
  }
};

/**
 * My personal tasks and the project tasks assigned to me. Tasks belonging to a
 * loaded workspace are kept; everything else is replaced by this response.
 */
export const loadTasks = async ({ silent = false } = {}) => {
  const session = sessionStamp();
  const user = getState().auth.user;
  if (!user) return null;
  if (!silent) setSlice("tasks", "loading");
  // Everything written locally from here on is newer than this response.
  const stamp = writeStamp();

  try {
    const [personal, assigned] = await Promise.all([
      api().listPersonalTasks(),
      api().listAssignedTasks(user.id),
    ]);
    if (!isCurrentSession(session)) return null;

    setState((state) => {
      const tasks = {};
      Object.entries(state.tasks).forEach(([taskId, task]) => {
        const workspace = task.projectId
          ? state.loaded.workspaces[task.projectId]
          : null;
        if (
          workspace === "ready" ||
          workspace === "loading" ||
          writtenSince(taskId, stamp)
        ) {
          tasks[taskId] = task;
        }
      });
      [...personal, ...assigned].forEach((task) => {
        // A task created, edited or deleted since the request went out is
        // newer than the row in it, whether or not it is still on screen.
        if (writtenSince(task.id, stamp)) return;
        tasks[task.id] = { ...tasks[task.id], ...task };
      });
      return { tasks };
    });
    setSlice("tasks", "ready");
    return [...personal, ...assigned];
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!silent) setSlice("tasks", "error", TASKS_ERROR);
    return null;
  }
};

export const loadInvitations = async ({ silent = false } = {}) => {
  const session = sessionStamp();
  const user = getState().auth.user;
  if (!user) return null;
  if (!silent) setSlice("invitations", "loading");
  const invitationsAtStart = getState().invitations;

  try {
    const invitations = await api().listMyInvitations(user.email);
    if (!isCurrentSession(session)) return null;
    setState((state) => ({
      invitations: mergeConcurrentListChanges(
        invitationsAtStart,
        state.invitations,
        invitations
      ),
    }));
    setSlice("invitations", "ready");
    return invitations;
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!silent) setSlice("invitations", "error", INVITATIONS_ERROR);
    return null;
  }
};

export const loadSettings = async ({ silent = false } = {}) => {
  const session = sessionStamp();
  const user = getState().auth.user;
  if (!user) return null;
  if (!silent) setSlice("settings", "loading");
  const settingsAtStart = getState().settings;

  try {
    const settings = await api().getSettings(user);
    if (!isCurrentSession(session)) return null;
    setState((state) => ({
      settings: state.settings === settingsAtStart ? settings : state.settings,
    }));
    setSlice("settings", "ready");
    return settings;
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!silent) setSlice("settings", "error", SETTINGS_ERROR);
    return null;
  }
};

/* -------------------------------------------------------------------------
 * Realtime
 * ---------------------------------------------------------------------- */

const unsubscribeNotifications = () => {
  try {
    notificationsUnsubscribe?.();
  } catch {
    // A closed channel is already unsubscribed.
  }
  notificationsUnsubscribe = null;
};

/** The channel is gone: nothing reloads the inbox until the page does. */
const DEAD_CHANNEL = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"];

const setNotificationsLive = (live) => setState({ notificationsLive: live });

const subscribeNotifications = (user) => {
  unsubscribeNotifications();
  setNotificationsLive(true);
  try {
    notificationsUnsubscribe = api().subscribeToNotifications(
      user.id,
      () => {
        void loadNotifications({ silent: true });
      },
      (status) => {
        if (status === "SUBSCRIBED") setNotificationsLive(true);
        else if (DEAD_CHANNEL.includes(status)) setNotificationsLive(false);
      }
    );
  } catch {
    // Nothing else refreshes the inbox, so the page says live updates are off.
    setNotificationsLive(false);
  }
};

/* -------------------------------------------------------------------------
 * Lifecycle
 * ---------------------------------------------------------------------- */

/**
 * Signs a person in to the store: every slice starts loading in parallel and
 * the returned promise resolves once they have all settled.
 */
export const startSession = async (user) => {
  if (!user) {
    setState({ auth: { status: "signed-out", user: null, recovery: false } });
    return;
  }

  setState((state) => ({
    auth: { status: "ready", user, recovery: state.auth.recovery },
  }));
  const session = sessionStamp();
  subscribeNotifications(user);

  await Promise.allSettled([
    loadProjects(),
    loadTasks(),
    loadInvitations(),
    loadSettings(),
    loadNotifications(),
  ]);
  if (isCurrentSession(session)) setState({ lastCoreLoadAt: Date.now() });
};

/** Signs out: drops the subscription, the timers and every loaded row. */
export const endSession = () => {
  unsubscribeNotifications();
  cancelRememberLastViewed();
  clearNotice();
  resetStore();
  setState({ auth: { status: "signed-out", user: null, recovery: false } });
};

/**
 * Silent reload of the core slices — no loading flags, no skeletons. Skipped
 * while the last load is still fresh.
 */
export const revalidate = async () => {
  const state = getState();
  if (!state.auth.user) return false;
  if (Date.now() - state.lastCoreLoadAt < REVALIDATE_MS) return false;

  setState({ lastCoreLoadAt: Date.now() });
  await Promise.allSettled([
    loadTasks({ silent: true }),
    loadProjects({ silent: true }),
    loadInvitations({ silent: true }),
  ]);
  return true;
};

/** Applies an `api/auth` event: recovery link, sign-in, sign-out, user switch. */
export const handleAuthEvent = (event, user) => {
  if (event === "PASSWORD_RECOVERY") {
    setState((state) => ({ auth: { ...state.auth, recovery: true } }));
    navigate("/recover");
    return Promise.resolve();
  }

  const { user: current, recovery } = getState().auth;
  if (!user) {
    endSession();
    return Promise.resolve();
  }
  if (current?.id === user.id) {
    setState((state) => ({ auth: { ...state.auth, user } }));
    return Promise.resolve();
  }

  // Always start a different person from an empty store, even when the
  // previous one already signed out: a load that resolved after their
  // sign-out must not leave rows behind for this session.
  endSession();
  if (recovery) {
    setState((state) => ({ auth: { ...state.auth, recovery: true } }));
  }
  return startSession(user);
};
