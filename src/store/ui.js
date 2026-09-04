/**
 * UI state actions: routing, the task panel, the composer, the shell chrome
 * and the transient notices. Nothing here talks to the api except through
 * `rememberLastViewed`, which persists the last visited page in settings.
 */
import { normalizePath, projectPath } from "../router";
import {
  readProjectTab,
  writeProfilePromptDismissed,
  writeProjectTab,
  writeSidebarCollapsed,
} from "../lib/preferences";
import { currentBrowserPath, getState, setState } from "./store";
import { rememberLastViewed } from "./settings";

const NOTICE_TIMEOUT_MS = 6_000;

let noticeTimer = null;

const patchUi = (patch) =>
  setState((state) => ({
    ui: typeof patch === "function" ? { ...state.ui, ...patch(state.ui) } : { ...state.ui, ...patch },
  }));

/* -------------------------------------------------------------------------
 * Routing
 * ---------------------------------------------------------------------- */

/** Navigates to `path`, closing the mobile nav and remembering the page. */
export const navigate = (path) => {
  const nextPath = normalizePath(path);
  const changed = getState().ui.path !== nextPath;

  patchUi({ path: nextPath, mobileNavOpen: false });
  if (!changed) return nextPath;

  try {
    window.history.pushState({}, "", nextPath);
    if (window.scrollY) window.scrollTo({ top: 0, behavior: "auto" });
  } catch {
    // Navigation still applies to the in-memory path.
  }
  rememberLastViewed(nextPath);
  return nextPath;
};

/**
 * Adopts the browser's path after a back/forward navigation, rewriting the
 * address bar when that path is not the one the app renders.
 */
export const syncPathFromBrowser = () => {
  patchUi({ path: currentBrowserPath() });
};

/** Opens a project workspace on the tab it was last left on. */
export const setProjectTab = (projectId, tab) => {
  if (!projectId) return;
  writeProjectTab(projectId, tab);
  navigate(projectPath(projectId, tab));
};

/* -------------------------------------------------------------------------
 * Task panel and composer
 * ---------------------------------------------------------------------- */

export const openTask = (taskId) => patchUi({ selectedTaskId: taskId || null });

export const closeTask = () => patchUi({ selectedTaskId: null });

/**
 * Opens a project task from outside its workspace: the workspace picks the
 * request up when it mounts and selects the task.
 */
export const openTaskInProject = (task) => {
  if (!task?.projectId) {
    openTask(task?.id || null);
    return;
  }
  patchUi({
    projectOpenRequest: {
      projectId: task.projectId,
      itemId: task.id,
      request: Date.now(),
    },
  });
  navigate(projectPath(task.projectId, readProjectTab(task.projectId)));
};

export const clearProjectOpenRequest = () => patchUi({ projectOpenRequest: null });

/** "New project" from anywhere: the Projects page opens its create dialog. */
export const openProjectCreate = () => {
  patchUi((ui) => ({ projectCreateRequest: ui.projectCreateRequest + 1 }));
  navigate("/projects");
};

/** Acknowledges the one-shot request after the Projects page opens its dialog. */
export const consumeProjectCreateRequest = () =>
  patchUi({ projectCreateRequest: 0 });

/** "Edit profile" from anywhere: the Settings page opens its profile panel. */
export const openProfileSettings = () => {
  patchUi((ui) => ({ profileSettingsRequest: ui.profileSettingsRequest + 1 }));
  navigate("/settings");
};

/** Acknowledges the one-shot request after Settings opens the profile panel. */
export const consumeProfileSettingsRequest = () =>
  patchUi({ profileSettingsRequest: 0 });

export const openComposer = (initialValues = {}, options = {}) => {
  const { workType, lockProject, ...values } = initialValues;
  patchUi({
    composer: {
      open: true,
      initialValues: values,
      workType: options.workType || workType || "task",
      lockProject: options.lockProject === true || lockProject === true,
    },
  });
};

export const closeComposer = () =>
  patchUi({
    composer: { open: false, initialValues: {}, workType: "task", lockProject: false },
  });

/* -------------------------------------------------------------------------
 * Shell chrome
 * ---------------------------------------------------------------------- */

export const toggleSidebar = () =>
  patchUi((ui) => {
    const sidebarCollapsed = !ui.sidebarCollapsed;
    writeSidebarCollapsed(sidebarCollapsed);
    return { sidebarCollapsed };
  });

export const setMobileNav = (open) => patchUi({ mobileNavOpen: open === true });

export const setSearchOpen = (open) => patchUi({ searchOpen: open === true });

export const dismissProfilePrompt = () => {
  writeProfilePromptDismissed(getState().auth.user?.id || "");
  patchUi({ profilePromptDismissed: true });
};

/* -------------------------------------------------------------------------
 * Notices
 * ---------------------------------------------------------------------- */

const clearNoticeTimer = () => {
  if (noticeTimer === null) return;
  clearTimeout(noticeTimer);
  noticeTimer = null;
};

export const clearNotice = () => {
  clearNoticeTimer();
  patchUi({ notice: null });
};

/** One transient message; it clears itself after six seconds. */
export const notify = ({ tone = "info", text } = {}) => {
  const message = String(text || "").trim();
  if (!message) return null;

  const notice = { tone, text: message, at: Date.now() };
  clearNoticeTimer();
  patchUi({ notice });
  noticeTimer = setTimeout(() => {
    noticeTimer = null;
    patchUi({ notice: null });
  }, NOTICE_TIMEOUT_MS);
  return notice;
};

export const setReminderNotice = (task) => patchUi({ reminderNotice: task || null });
