/**
 * Routing table for the TaskFlow shell: sidebar navigation, path normalization,
 * project paths (with their tab) and the document title for a view.
 */

export const navigationItems = [
  { label: "Home", path: "/", icon: "home" },
  { label: "My Tasks", path: "/tasks", icon: "check-square" },
  { label: "Calendar", path: "/calendar", icon: "calendar" },
  { label: "Inbox", path: "/inbox", icon: "inbox" },
  { label: "Projects", path: "/projects", icon: "folders" },
];

export const routeViews = {
  "/": "home",
  "/tasks": "tasks",
  "/calendar": "calendar",
  "/inbox": "inbox",
  "/projects": "projects",
  "/settings": "settings",
  "/archived-tasks": "archived",
  "/recover": "recover",
};

/** Tabs of the project workspace, in the order the header shows them. */
export const projectTabs = ["overview", "board", "list", "stories"];

const PROJECTS_PREFIX = "/projects/";

const projectSegments = (pathname) =>
  typeof pathname === "string" && pathname.startsWith(PROJECTS_PREFIX)
    ? pathname.slice(PROJECTS_PREFIX.length).split("/")
    : null;

export const projectIdFromPath = (pathname) => {
  const segments = projectSegments(pathname);
  if (!segments || !segments[0]) return null;

  try {
    const projectId = decodeURIComponent(segments[0]);
    return projectId && !projectId.includes("/") ? projectId : null;
  } catch {
    return null;
  }
};

export const projectTabFromPath = (pathname) => {
  if (!projectIdFromPath(pathname)) return "overview";
  const tab = projectSegments(pathname)?.[1];
  return projectTabs.includes(tab) ? tab : "overview";
};

export const projectPath = (projectId, tab = "overview") =>
  `${PROJECTS_PREFIX}${encodeURIComponent(projectId)}/${
    projectTabs.includes(tab) ? tab : "overview"
  }`;

export const normalizePath = (pathname) => {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (routeViews[withoutTrailingSlash]) return withoutTrailingSlash;

  const projectId = projectIdFromPath(withoutTrailingSlash);
  return projectId
    ? projectPath(projectId, projectTabFromPath(withoutTrailingSlash))
    : "/";
};

export const routeViewFromPath = (pathname) =>
  projectIdFromPath(pathname) ? "project" : routeViews[pathname];

export const isNavigationItemActive = (itemPath, currentPath, currentView) =>
  itemPath === currentPath ||
  (itemPath === "/projects" && currentView === "project") ||
  (itemPath === "/settings" && currentView === "archived");

const viewTitles = {
  home: "Home",
  tasks: "My Tasks",
  calendar: "Calendar",
  inbox: "Inbox",
  projects: "Projects",
  settings: "Settings",
  archived: "Archived tasks",
  recover: "Password recovery",
};

/** Title used for `document.title` only — pages render their own headings. */
export const pageTitle = (view, selectedProject) => {
  if (view === "project") return selectedProject?.name || "Project";
  return viewTitles[view] || "TaskFlow";
};
