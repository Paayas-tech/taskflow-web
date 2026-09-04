/**
 * The single client store. Module-level state, a listener set and the api the
 * action modules call. Components read with `useStore(selector)`; every
 * mutation goes through an action module (`store/tasks.js`, `store/projects.js`…)
 * which updates this state optimistically and calls the api in the background.
 */
import { useCallback, useSyncExternalStore } from "react";
import { normalizePath } from "../router";
import { normalizeSettings } from "../domain/settings";
import { readSidebarCollapsed } from "../lib/preferences";

const deps = { api: null };

const listeners = new Set();

/**
 * The normalized path the app will render, with the address bar rewritten to
 * match it: an unknown or denormalized URL (`/nonsense`, `/tasks/`) must not
 * stay in the bar while a different page is on screen.
 */
export const currentBrowserPath = () => {
  try {
    const path = normalizePath(window.location.pathname);
    if (window.location.pathname !== path) {
      window.history.replaceState(
        {},
        "",
        `${path}${window.location.search}${window.location.hash}`
      );
    }
    return path;
  } catch {
    return "/";
  }
};

/** The state a fresh session starts from. */
export const initialState = () => ({
  auth: { status: "booting", user: null, recovery: false },
  settings: normalizeSettings({}),
  tasks: {},
  projects: {},
  columns: {},
  members: {},
  profiles: {},
  invitations: [],
  notifications: [],
  attachmentCounts: {},
  googleEvents: [],
  // False once the realtime notification channel drops (the inbox says so).
  notificationsLive: true,
  loaded: {
    tasks: "idle",
    projects: "idle",
    invitations: "idle",
    settings: "idle",
    notifications: "idle",
    googleEvents: "idle",
    workspaces: {},
  },
  errors: {
    tasks: "",
    projects: "",
    invitations: "",
    settings: "",
    notifications: "",
    workspaces: {},
  },
  pending: {},
  // Freshness stamps for the silent revalidations (see session.js/projects.js).
  workspaceLoadedAt: {},
  lastCoreLoadAt: 0,
  ui: {
    path: currentBrowserPath(),
    selectedTaskId: null,
    composer: { open: false, initialValues: {}, workType: "task", lockProject: false },
    searchOpen: false,
    sidebarCollapsed: readSidebarCollapsed(),
    mobileNavOpen: false,
    notice: null,
    reminderNotice: null,
    projectOpenRequest: null,
    // Counters bumped by the sidebar/user menu; the target page reacts to a change.
    projectCreateRequest: 0,
    profileSettingsRequest: 0,
    profilePromptDismissed: false,
  },
});

let state = initialState();

const emit = () => {
  const snapshot = state;
  listeners.forEach((listener) => listener(snapshot));
};

export const getState = () => state;

/* -------------------------------------------------------------------------
 * Session fencing
 * ---------------------------------------------------------------------- */

let session = 0;

/**
 * The current session, bumped by every reset. A loader captures it before its
 * first await and drops the response when it no longer matches, so a request
 * still on the wire at sign-out cannot write into the next person's store.
 */
export const sessionStamp = () => session;

export const isCurrentSession = (stamp) => stamp === session;

const resetHooks = new Set();

/** Registers module state (queues, in-flight loads) to clear on every reset. */
export const onStoreReset = (hook) => {
  resetHooks.add(hook);
  return () => resetHooks.delete(hook);
};

/**
 * Merges a partial state (or the result of an updater) into the store and
 * notifies subscribers. Nothing is emitted when every key keeps its reference.
 */
export const setState = (partialOrUpdater) => {
  const partial =
    typeof partialOrUpdater === "function"
      ? partialOrUpdater(state)
      : partialOrUpdater;
  if (!partial) return state;

  const changed = Object.keys(partial).some(
    (key) => !Object.is(state[key], partial[key])
  );
  if (!changed) return state;

  state = { ...state, ...partial };
  emit();
  return state;
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Back to `initialState()` — sign-out and every test start from here. */
export const resetStore = () => {
  session += 1;
  resetHooks.forEach((hook) => hook());
  state = initialState();
  emit();
  return state;
};

/**
 * Configures the store with the api the actions call: the real `src/api` in
 * `main.jsx`, an in-memory fake in tests. Resets the state.
 */
export const configureStore = ({ api: nextApi } = {}) => {
  deps.api = nextApi || null;
  resetStore();
};

/** The api accessor every action module uses; never import `src/api` there. */
export const api = () => {
  if (!deps.api) {
    throw new Error("The store has not been configured with an api.");
  }
  return deps.api;
};

const identity = (value) => value;

/**
 * Subscribes a component to the store. `selector` must be stable and return a
 * stable reference for unchanged input — use the memoized `selectors.js`.
 */
export const useStore = (selector = identity) => {
  const getSnapshot = useCallback(() => selector(getState()), [selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
