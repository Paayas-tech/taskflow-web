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
} from "./router";

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

describe("path normalization", () => {
  it.each(staticRoutes)("keeps %s and drops its trailing slash", (path) => {
    expect(normalizePath(path)).toBe(path);
    if (path !== "/") expect(normalizePath(`${path}/`)).toBe(path);
  });

  it.each([
    "/unknown",
    "/projects/%2F",
    "/%E0%A4%A",
    "/today",
    "/planning/timeline",
    "/tasks?filter=today",
    "/recover#token",
  ])("falls back to home for %s", (path) => {
    expect(normalizePath(path)).toBe("/");
  });

  it("treats a missing project id as the projects route", () => {
    expect(normalizePath("/projects/")).toBe("/projects");
    expect(projectIdFromPath("/projects/")).toBeNull();
  });
});

describe("project routes", () => {
  it("redirects a bare project path to its overview tab", () => {
    expect(normalizePath("/projects/project-a")).toBe(
      "/projects/project-a/overview"
    );
    expect(normalizePath("/projects/project-a/")).toBe(
      "/projects/project-a/overview"
    );
  });

  it.each(projectTabs)("keeps the %s tab path", (tab) => {
    expect(normalizePath(`/projects/project-a/${tab}`)).toBe(
      `/projects/project-a/${tab}`
    );
    expect(projectTabFromPath(`/projects/project-a/${tab}`)).toBe(tab);
    expect(routeViewFromPath(`/projects/project-a/${tab}`)).toBe("project");
  });

  it("sends an unknown project sub-path back to the overview tab", () => {
    expect(normalizePath("/projects/project-a/extra")).toBe(
      "/projects/project-a/overview"
    );
    expect(projectTabFromPath("/projects/project-a/extra")).toBe("overview");
    expect(projectTabFromPath("/tasks")).toBe("overview");
  });

  it("round-trips encoded project ids and rejects path separators", () => {
    const id = "project name + review";
    const path = projectPath(id, "list");

    expect(path).toBe("/projects/project%20name%20%2B%20review/list");
    expect(projectIdFromPath(path)).toBe(id);
    expect(projectTabFromPath(path)).toBe("list");
    expect(normalizePath(path)).toBe(path);
    expect(projectIdFromPath("/projects/team%2Fproject")).toBeNull();
    expect(projectIdFromPath("/projects/123e4567-e89b-12d3-a456-426614174000/board"))
      .toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("defaults projectPath to the overview tab and ignores unknown tabs", () => {
    expect(projectPath("project-a")).toBe("/projects/project-a/overview");
    expect(projectPath("project-a", "timeline")).toBe(
      "/projects/project-a/overview"
    );
  });
});

describe("route presentation", () => {
  it.each(staticRoutes)("maps %s to the %s view", (path, view) => {
    expect(routeViewFromPath(path)).toBe(view);
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
