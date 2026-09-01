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

  const encodedProjectId = pathname.slice("/projects/".length);
  if (!encodedProjectId || encodedProjectId.includes("/")) return null;

  try {
    const projectId = decodeURIComponent(encodedProjectId);
    return projectId && !projectId.includes("/") ? projectId : null;
  } catch {
    return null;
  }
};

export const projectPath = (projectId) =>
  `/projects/${encodeURIComponent(projectId)}`;

export const normalizePath = (pathname) => {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (withoutTrailingSlash === "/today") return "/";
  if (withoutTrailingSlash === "/plans") return "/planning/timeline";
  if (routeViews[withoutTrailingSlash]) return withoutTrailingSlash;

  const projectId = projectIdFromPath(withoutTrailingSlash);
  return projectId ? projectPath(projectId) : "/";
};

export const routeViewFromPath = (pathname) =>
  projectIdFromPath(pathname) ? "project" : routeViews[pathname];

export const isNavigationItemActive = (itemPath, currentPath, currentView) =>
  itemPath === currentPath ||
  (itemPath === "/tasks" && currentPath === "/tasks") ||
  (itemPath === "/projects" && currentView === "project") ||
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
                : currentView === "project"
                  ? selectedProject?.name || "Project"
                  : "Dashboard",
  subtitle:
    currentView === "tasks"
      ? `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`
      : currentView === "for-you"
        ? "Your assigned, upcoming, and important work."
        : currentView === "recent"
          ? "Work you opened recently."
          : currentView === "starred"
            ? "Important work saved for quick access."
            : currentView?.startsWith("planning-")
                ? "Plan and understand work across your projects."
      : currentView === "inbox"
        ? "Updates, mentions, and assignments that need your attention."
      : currentView === "archived"
          ? `${archivedTaskCount} ${
              archivedTaskCount === 1 ? "archived task" : "archived tasks"
            }`
          : currentView === "settings"
              ? "Personalize reminders, notifications, appearance, and your profile."
              : currentView === "projects"
                ? `${projectCount} ${projectCount === 1 ? "project" : "projects"}`
                : currentView === "project"
                  ? selectedProject
                    ? "Board, list, and calendar views for this project."
                    : projectsLoading
                      ? "Loading project..."
                      : "Project unavailable"
                  : "A clear view of what needs your attention.",
});
