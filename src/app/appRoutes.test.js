import { describe, expect, it } from "vitest";
import {
  isNavigationItemActive,
  navigationItems,
  normalizePath,
  pageMetadata,
  projectIdFromPath,
  projectPath,
  routeViewFromPath,
  routeViews,
} from "./appRoutes";

const staticRoutes = [
  ["/", "dashboard"],
  ["/for-you", "for-you"],
  ["/recent", "recent"],
  ["/starred", "starred"],
  ["/planning/timeline", "planning-timeline"],
  ["/planning/board", "planning-board"],
  ["/planning/lists", "planning-lists"],
  ["/planning/goals", "planning-goals"],
  ["/planning/issues", "planning-issues"],
  ["/inbox", "inbox"],
  ["/tasks", "tasks"],
  ["/calendar", "tasks"],
  ["/projects", "projects"],
  ["/settings", "settings"],
  ["/archived-tasks", "archived"],
  ["/recover", "recover"],
];

describe("TaskFlow route normalization", () => {
  it.each(staticRoutes)("keeps the known route %s", (path) => {
    expect(normalizePath(path)).toBe(path);
  });

  it.each(staticRoutes.filter(([path]) => path !== "/"))(
    "removes a trailing slash from %s",
    (path) => {
      expect(normalizePath(`${path}/`)).toBe(path);
    }
  );

  it.each(["/unknown", "/projects/id/extra", "/projects/%2F", "/%E0%A4%A"])(
    "falls back to the dashboard for %s",
    (path) => {
      expect(normalizePath(path)).toBe("/");
    }
  );

  it("treats a missing project id as the projects route", () => {
    expect(normalizePath("/projects/")).toBe("/projects");
    expect(projectIdFromPath("/projects/")).toBeNull();
  });

  it("does not parse query strings or hashes from a pathname argument", () => {
    expect(normalizePath("/tasks?filter=today")).toBe("/");
    expect(normalizePath("/recover#token")).toBe("/");
  });

  it("redirects legacy Today links to the Dashboard and preserves Calendar", () => {
    expect(normalizePath("/today")).toBe("/");
    expect(normalizePath("/today/")).toBe("/");
    expect(normalizePath("/calendar")).toBe("/calendar");
    expect(normalizePath("/calendar/")).toBe("/calendar");
  });
});

describe("TaskFlow project routes", () => {
  it("extracts a UUID-like project id", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(projectIdFromPath(`/projects/${id}`)).toBe(id);
  });

  it("round-trips encoded project ids", () => {
    const id = "project name + review";
    const path = projectPath(id);

    expect(path).toBe("/projects/project%20name%20%2B%20review");
    expect(projectIdFromPath(path)).toBe(id);
    expect(normalizePath(path)).toBe(path);
  });

  it("rejects decoded ids that contain path separators", () => {
    expect(projectIdFromPath("/projects/team%2Fproject")).toBeNull();
  });
});

describe("TaskFlow route presentation", () => {
  it.each(staticRoutes)("maps %s to the %s view", (path, view) => {
    expect(routeViews[path]).toBe(view);
    expect(routeViewFromPath(path)).toBe(view);
  });

  it("keeps recovery distinct from authenticated routes", () => {
    expect(routeViewFromPath("/recover")).toBe("recover");
    expect(routeViewFromPath("/recover")).not.toBe("dashboard");
  });

  it("maps project detail paths to the project view", () => {
    expect(routeViewFromPath("/projects/project-a")).toBe("project");
  });

  it("preserves the sidebar route metadata and disabled reminder item", () => {
    expect(navigationItems).toEqual([
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
    ]);
  });

  it("preserves sidebar parent activation for project and archived views", () => {
    expect(isNavigationItemActive("/projects", "/projects/project-a", "project")).toBe(true);
    expect(isNavigationItemActive("/settings", "/archived-tasks", "archived")).toBe(true);
    expect(isNavigationItemActive("/tasks", "/projects/project-a", "project")).toBe(false);
  });

  it("preserves route-derived page metadata", () => {
    expect(
      pageMetadata({
        currentView: "project",
        taskCount: 0,
        archivedTaskCount: 0,
        projectCount: 1,
        selectedProject: { name: "Launch" },
        projectsLoading: false,
      })
    ).toEqual({
      title: "Launch",
      subtitle: "Board, list, and calendar views for this project.",
    });

    expect(
      pageMetadata({
        currentView: "tasks",
        taskCount: 1,
        archivedTaskCount: 0,
        projectCount: 0,
        selectedProject: null,
        projectsLoading: false,
      })
    ).toEqual({ title: "Tasks", subtitle: "1 task" });
  });

  it.each([
    ["dashboard", "Dashboard", "A clear view of what needs your attention."],
    ["inbox", "Inbox", "Updates, mentions, and assignments that need your attention."],
    ["settings", "Settings", "Personalize reminders, notifications, appearance, and your profile."],
    ["projects", "Projects", "2 projects"],
    ["archived", "Archived Tasks", "2 archived tasks"],
  ])("preserves %s page copy", (currentView, title, subtitle) => {
    expect(
      pageMetadata({
        currentView,
        taskCount: 2,
        archivedTaskCount: 2,
        projectCount: 2,
        selectedProject: null,
        projectsLoading: false,
      })
    ).toEqual({ title, subtitle });
  });

  it.each([
    [true, "Loading project..."],
    [false, "Project unavailable"],
  ])("preserves missing-project metadata when loading is %s", (projectsLoading, subtitle) => {
    expect(
      pageMetadata({
        currentView: "project",
        taskCount: 0,
        archivedTaskCount: 0,
        projectCount: 0,
        selectedProject: null,
        projectsLoading,
      })
    ).toEqual({ title: "Project", subtitle });
  });
});
