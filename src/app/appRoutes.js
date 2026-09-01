export const navigationItems = [
  { label: "For you", path: "/for-you", enabled: true, icon: "for-you", group: "workspace" },
  { label: "Recent", path: "/recent", enabled: true, icon: "recent", group: "workspace" },
  { label: "Starred", path: "/starred", enabled: true, icon: "starred", group: "workspace" },
  { label: "Timeline", path: "/planning/timeline", enabled: true, icon: "timeline", group: "planning" },
  { label: "Board", path: "/planning/board", enabled: true, icon: "board", group: "planning" },
  { label: "Lists", path: "/planning/lists", enabled: true, icon: "lists", group: "planning" },
  { label: "Goals", path: "/planning/goals", enabled: true, icon: "goals", group: "planning" },
  { label: "Issues", path: "/planning/issues", enabled: true, icon: "issues", group: "planning" },
  { label: "Dashboard", path: "/", enabled: true, icon: "dashboard" },
  { label: "Inbox", path: "/inbox", enabled: true, icon: "inbox" },
  { label: "Tasks", path: "/tasks", enabled: true, icon: "tasks" },
  { label: "Projects", path: "/projects", enabled: true, icon: "projects" },
  { label: "Calendar", path: "/calendar", enabled: true, icon: "calendar" },
  { label: "Reminders", enabled: false, icon: "reminders" },
  { label: "Settings", path: "/settings", enabled: true, icon: "settings" },
];

export const routeViews = {
  "/": "dashboard",
  "/for-you": "for-you",
  "/recent": "recent",
  "/starred": "starred",
  "/planning/timeline": "planning-timeline",
  "/planning/board": "planning-board",
  "/planning/lists": "planning-lists",
  "/planning/goals": "planning-goals",
  "/planning/issues": "planning-issues",
  "/inbox": "inbox",
  "/tasks": "tasks",
  "/calendar": "tasks",
  "/projects": "projects",
  "/settings": "settings",
  "/archived-tasks": "archived",
  "/recover": "recover",
};

export const projectIdFromPath = (pathname) => {
  if (!pathname.startsWith("/projects/")) return null;

  const segments = pathname.slice("/projects/".length).split("/");
  if (!segments[0] || segments.length > 2 || (segments[1] && segments[1] !== "overview")) return null;
  const encodedProjectId = segments[0];

  try {
    const projectId = decodeURIComponent(encodedProjectId);
    return projectId && !projectId.includes("/") ? projectId : null;
  } catch {
    return null;
  }
};

export const projectPath = (projectId) =>
  `/projects/${encodeURIComponent(projectId)}`;
export const projectOverviewPath = (projectId) => `${projectPath(projectId)}/overview`;

export const normalizePath = (pathname) => {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (withoutTrailingSlash === "/today") return "/";
  if (withoutTrailingSlash === "/plans") return "/planning/timeline";
  if (routeViews[withoutTrailingSlash]) return withoutTrailingSlash;

  const projectId = projectIdFromPath(withoutTrailingSlash);
  return projectId ? (withoutTrailingSlash.endsWith("/overview") ? projectOverviewPath(projectId) : projectPath(projectId)) : "/";
};

export const routeViewFromPath = (pathname) =>
  projectIdFromPath(pathname) ? (pathname.endsWith("/overview") ? "project-overview" : "project") : routeViews[pathname];

export const isNavigationItemActive = (itemPath, currentPath, currentView) =>
  itemPath === currentPath ||
  (itemPath === "/tasks" && currentPath === "/tasks") ||
  (itemPath === "/projects" && ["project", "project-overview"].includes(currentView)) ||
  (itemPath === "/settings" && currentView === "archived");

export const pageMetadata = ({
  currentView,
  taskCount,
  archivedTaskCount,
  projectCount,
  selectedProject,
  projectsLoading,
}) => ({
  title:
    currentView === "tasks"
      ? "Tasks"
      : currentView === "for-you"
        ? "For you"
        : currentView === "recent"
          ? "Recent"
          : currentView === "starred"
            ? "Starred"
            : currentView?.startsWith("planning-")
                ? currentView.replace("planning-", "").replace(/^./, (value) => value.toUpperCase())
      : currentView === "inbox"
        ? "Inbox"
      : currentView === "archived"
          ? "Archived Tasks"
          : currentView === "settings"
              ? "Settings"
              : currentView === "projects"
                ? "Projects"
                : ["project", "project-overview"].includes(currentView)
                  ? selectedProject?.name || "Project"
                  : "Dashboard",
  subtitle:
    currentView === "tasks"
      ? `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`
      : currentView === "for-you"
        ? "Assigned and upcoming work."
        : currentView === "recent"
          ? "Recently opened work."
          : currentView === "starred"
            ? "Saved work."
            : currentView?.startsWith("planning-")
                ? "Plan across projects."
      : currentView === "inbox"
        ? "Updates and mentions."
      : currentView === "archived"
          ? `${archivedTaskCount} ${
              archivedTaskCount === 1 ? "archived task" : "archived tasks"
            }`
          : currentView === "settings"
              ? "Preferences and account."
              : currentView === "projects"
                ? `${projectCount} ${projectCount === 1 ? "project" : "projects"}`
                : ["project", "project-overview"].includes(currentView)
                  ? selectedProject
                    ? "Project work and planning."
                    : projectsLoading
                      ? "Loading project..."
                      : "Project unavailable"
                  : "Work that needs attention.",
});
