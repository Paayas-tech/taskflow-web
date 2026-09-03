import { describe, expect, it } from "vitest";
import {
  isNavigationItemActive,
  navigationItems,
  normalizePath,
  pageTitle,
  projectIdFromPath,
  projectPath,
  projectTabFromPath,
  projectTabs,
  routeViewFromPath,
  routeViews,
} from "./appRoutes";

const staticRoutes = [
  ["/", "home"],
  ["/tasks", "tasks"],
  ["/calendar", "calendar"],
  ["/inbox", "inbox"],
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

  it.each(["/unknown", "/projects/%2F", "/%E0%A4%A"])(
    "falls back to home for %s",
    (path) => {
      expect(normalizePath(path)).toBe("/");
    }
  );

  it.each(["/for-you", "/recent", "/starred", "/planning/timeline", "/plans", "/today"])(
    "normalizes the removed route %s to home",
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
});

describe("TaskFlow project routes", () => {
  it("redirects a bare project path to its overview tab", () => {
    expect(normalizePath("/projects/project-a")).toBe("/projects/project-a/overview");
    expect(normalizePath("/projects/project-a/")).toBe("/projects/project-a/overview");
  });

  it.each(projectTabs)("keeps the %s tab path", (tab) => {
    expect(normalizePath(`/projects/project-a/${tab}`)).toBe(
      `/projects/project-a/${tab}`
    );
    expect(projectTabFromPath(`/projects/project-a/${tab}`)).toBe(tab);
  });

  it("sends an unknown project sub-path back to the overview tab", () => {
    expect(normalizePath("/projects/project-a/extra")).toBe(
      "/projects/project-a/overview"
    );
    expect(projectTabFromPath("/projects/project-a/extra")).toBe("overview");
    expect(projectTabFromPath("/tasks")).toBe("overview");
  });

  it("extracts a UUID-like project id", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(projectIdFromPath(`/projects/${id}/board`)).toBe(id);
  });

  it("round-trips encoded project ids", () => {
    const id = "project name + review";
    const path = projectPath(id, "list");

    expect(path).toBe("/projects/project%20name%20%2B%20review/list");
    expect(projectIdFromPath(path)).toBe(id);
    expect(projectTabFromPath(path)).toBe("list");
    expect(normalizePath(path)).toBe(path);
  });

  it("defaults projectPath to the overview tab and ignores unknown tabs", () => {
    expect(projectPath("project-a")).toBe("/projects/project-a/overview");
    expect(projectPath("project-a", "timeline")).toBe(
      "/projects/project-a/overview"
    );
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
    expect(routeViewFromPath("/recover")).not.toBe("home");
  });

  it.each(projectTabs)("maps the %s tab path to the project view", (tab) => {
    expect(routeViewFromPath(`/projects/project-a/${tab}`)).toBe("project");
  });

  it("lists the five primary navigation items in order", () => {
    expect(navigationItems).toEqual([
      { label: "Home", path: "/", icon: "home" },
      { label: "My Tasks", path: "/tasks", icon: "check-square" },
      { label: "Calendar", path: "/calendar", icon: "calendar" },
      { label: "Inbox", path: "/inbox", icon: "inbox" },
      { label: "Projects", path: "/projects", icon: "folders" },
    ]);
  });

  it("keeps parent activation for project and archived views", () => {
    expect(
      isNavigationItemActive("/projects", "/projects/project-a/board", "project")
    ).toBe(true);
    expect(isNavigationItemActive("/settings", "/archived-tasks", "archived")).toBe(
      true
    );
    expect(
      isNavigationItemActive("/tasks", "/projects/project-a/board", "project")
    ).toBe(false);
    expect(isNavigationItemActive("/tasks", "/tasks", "tasks")).toBe(true);
  });

  it.each([
    ["home", "Home"],
    ["tasks", "My Tasks"],
    ["calendar", "Calendar"],
    ["inbox", "Inbox"],
    ["projects", "Projects"],
    ["settings", "Settings"],
    ["archived", "Archived tasks"],
  ])("titles the %s view", (view, title) => {
    expect(pageTitle(view, null)).toBe(title);
  });

  it("titles the project view with the project name", () => {
    expect(pageTitle("project", { name: "Launch" })).toBe("Launch");
    expect(pageTitle("project", null)).toBe("Project");
    expect(pageTitle(undefined, null)).toBe("TaskFlow");
  });
});
