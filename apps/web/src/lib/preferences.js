/**
 * Browser preferences: the handful of per-device choices TaskFlow remembers
 * outside the account settings row. Every read and write is guarded so a
 * blocked or full storage never breaks a page.
 */
import { projectTabs } from "../router";

const SIDEBAR_KEY = "taskflow:sidebar-collapsed";
const MY_TASKS_VIEW_KEY = "taskflow:my-tasks-view";
const MY_TASKS_GROUP_KEY = "taskflow:my-tasks-group";
const projectTabKey = (projectId) => `taskflow:project-tab:${projectId}`;
const profilePromptKey = (userId) =>
  `taskflow.profile-prompt-dismissed.${userId}`;

const MY_TASKS_VIEWS = ["list", "board"];
const MY_TASKS_GROUPS = ["due", "priority", "project", "status"];

const localRead = (key) => {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const localWrite = (key, value) => {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // The choice still applies for the current session.
  }
};

const sessionRead = (key) => {
  try {
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const sessionWrite = (key, value) => {
  try {
    window.sessionStorage?.setItem(key, value);
  } catch {
    // The choice still applies for the current session.
  }
};

/** Last workspace tab opened for a project, defaulting to Overview. */
export const readProjectTab = (projectId) => {
  if (!projectId) return "overview";
  const stored = localRead(projectTabKey(projectId));
  return projectTabs.includes(stored) ? stored : "overview";
};

/** Remembers the workspace tab so sidebar and widget links reopen it. */
export const writeProjectTab = (projectId, tab) => {
  if (!projectId || !projectTabs.includes(tab)) return;
  localWrite(projectTabKey(projectId), tab);
};

export const readSidebarCollapsed = () => localRead(SIDEBAR_KEY) === "true";

export const writeSidebarCollapsed = (collapsed) =>
  localWrite(SIDEBAR_KEY, collapsed === true ? "true" : "false");

export const readMyTasksView = () => {
  const stored = localRead(MY_TASKS_VIEW_KEY);
  return MY_TASKS_VIEWS.includes(stored) ? stored : "list";
};

export const writeMyTasksView = (view) => {
  if (!MY_TASKS_VIEWS.includes(view)) return;
  localWrite(MY_TASKS_VIEW_KEY, view);
};

export const readMyTasksGroup = () => {
  const stored = localRead(MY_TASKS_GROUP_KEY);
  return MY_TASKS_GROUPS.includes(stored) ? stored : "due";
};

export const writeMyTasksGroup = (group) => {
  if (!MY_TASKS_GROUPS.includes(group)) return;
  localWrite(MY_TASKS_GROUP_KEY, group);
};

/** The profile prompt is dismissed for the session, per account. */
export const readProfilePromptDismissed = (userId) =>
  userId ? sessionRead(profilePromptKey(userId)) === "true" : false;

export const writeProfilePromptDismissed = (userId) => {
  if (!userId) return;
  sessionWrite(profilePromptKey(userId), "true");
};
