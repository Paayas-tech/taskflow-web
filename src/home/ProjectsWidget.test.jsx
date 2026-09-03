import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, props, textContent } from "../test/elementTree";
import { Button, EmptyState } from "../ui";
import ProjectsWidget from "./ProjectsWidget";
import { WidgetError, WidgetSkeleton } from "./Widget";

const projects = [
  {
    id: "apollo",
    name: "Apollo",
    status: "active",
    color: "#ff8800",
    viewerRole: "owner",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "bee",
    name: "Bee",
    status: "archived",
    viewerRole: "editor",
    updatedAt: "2026-09-02T00:00:00Z",
  },
  {
    id: "comet",
    name: "Comet",
    status: "active",
    viewerRole: "viewer",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

const baseProps = (overrides = {}) => ({
  projects,
  onNavigate: vi.fn(),
  onNewProject: vi.fn(),
  ...overrides,
});

const rows = (tree) =>
  findAll(tree, (node) => props(node).className === "widget-row project-row");

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  };
});

afterEach(() => {
  delete globalThis.window;
});

describe("ProjectsWidget", () => {
  it("lists active projects, newest update first, with the viewer role", () => {
    const tree = ProjectsWidget(baseProps());

    expect(props(tree).title).toBe("Projects");
    expect(rows(tree).map((row) => textContent(row))).toEqual(["Comet Viewer", "Apollo Owner"]);
  });

  it("shows at most six projects", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      name: `Project ${index}`,
      status: "active",
      updatedAt: `2026-09-0${index % 9}T00:00:00Z`,
    }));

    expect(rows(ProjectsWidget(baseProps({ projects: many })))).toHaveLength(6);
  });

  it("opens a project on its remembered tab", () => {
    storage.set("taskflow:project-tab:comet", "board");
    const widgetProps = baseProps();
    const tree = ProjectsWidget(widgetProps);

    props(rows(tree)[0]).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/projects/comet/board");

    props(rows(tree)[1]).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/projects/apollo/overview");
  });

  it("creates a project from the header button and links to the project list", () => {
    const widgetProps = baseProps();
    const tree = ProjectsWidget(widgetProps);
    const actions = props(tree).actions;

    props(find(actions, (node) => props(node).label === "New project")).onClick();
    expect(widgetProps.onNewProject).toHaveBeenCalledTimes(1);

    props(
      find(actions, (node) => node.type === Button && textContent(node) === "View all")
    ).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/projects");
  });

  it("offers to create the first project when there is none", () => {
    const widgetProps = baseProps({ projects: [] });
    const tree = ProjectsWidget(widgetProps);
    const empty = find(tree, (node) => node.type === EmptyState);

    expect(props(empty).title).toBe("No projects yet");

    props(find(props(empty).action, (node) => textContent(node) === "Create a project")).onClick();
    expect(widgetProps.onNewProject).toHaveBeenCalledTimes(1);
  });

  it("shows the loading and error states", () => {
    expect(
      find(ProjectsWidget(baseProps({ loading: true })), (node) => node.type === WidgetSkeleton)
    ).toBeDefined();

    const onRetry = vi.fn();
    const failed = ProjectsWidget(baseProps({ error: "Projects are unavailable.", onRetry }));
    const notice = find(failed, (node) => node.type === WidgetError);

    expect(props(notice).message).toBe("Projects are unavailable.");
    expect(props(notice).onRetry).toBe(onRetry);
    expect(rows(failed)).toHaveLength(0);
  });
});
