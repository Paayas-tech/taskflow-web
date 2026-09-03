import { projectTabs } from "../app/appRoutes";

const storageKey = (projectId) => `taskflow:project-tab:${projectId}`;

/** Last workspace tab opened for a project, defaulting to Overview. */
export const readProjectTab = (projectId) => {
  if (!projectId) return "overview";
  try {
    const stored = window.localStorage?.getItem(storageKey(projectId));
    return projectTabs.includes(stored) ? stored : "overview";
  } catch {
    return "overview";
  }
};

/** Remembers the workspace tab so sidebar and widget links reopen it. */
export const writeProjectTab = (projectId, tab) => {
  if (!projectId || !projectTabs.includes(tab)) return;
  try {
    window.localStorage?.setItem(storageKey(projectId), tab);
  } catch {
    // The tab still applies for the current session.
  }
};
