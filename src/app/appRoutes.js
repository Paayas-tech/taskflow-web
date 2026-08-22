export const navigationItems = [
  { label: "Dashboard", path: "/", enabled: true, icon: "dashboard" },
  { label: "Today", path: "/today", enabled: true, icon: "today" },
  { label: "Tasks", path: "/tasks", enabled: true, icon: "tasks" },
  { label: "Projects", path: "/projects", enabled: true, icon: "projects" },
  { label: "Calendar", path: "/calendar", enabled: true, icon: "calendar" },
  { label: "Reminders", enabled: false, icon: "reminders" },
  { label: "Settings", path: "/settings", enabled: true, icon: "settings" },
];

export const routeViews = {
  "/": "dashboard",
  "/today": "today",
  "/tasks": "tasks",
  "/projects": "projects",
  "/calendar": "calendar",
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
  if (routeViews[withoutTrailingSlash]) return withoutTrailingSlash;

  const projectId = projectIdFromPath(withoutTrailingSlash);
  return projectId ? projectPath(projectId) : "/";
};

export const routeViewFromPath = (pathname) =>
  projectIdFromPath(pathname) ? "project" : routeViews[pathname];

export const isNavigationItemActive = (itemPath, currentPath, currentView) =>
  itemPath === currentPath ||
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
      : currentView === "today"
        ? "Today"
        : currentView === "archived"
          ? "Archived Tasks"
          : currentView === "calendar"
            ? "Calendar"
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
      : currentView === "today"
        ? "Overdue and due-today tasks in one focused view."
        : currentView === "archived"
          ? `${archivedTaskCount} ${
              archivedTaskCount === 1 ? "archived task" : "archived tasks"
            }`
          : currentView === "calendar"
            ? "Plan dated work from your existing TaskFlow tasks."
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
