import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const dialogCalls = vi.hoisted(() => ({ project: [], members: [] }));

vi.mock("../projects/ProjectDialog", () => ({
  default: (dialogProps) => {
    dialogCalls.project.push(dialogProps);
    return null;
  },
}));

vi.mock("../collaboration/ProjectMembersModal", () => ({
  default: (modalProps) => {
    dialogCalls.members.push(modalProps);
    return null;
  },
}));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { ProjectHeader } from "./ProjectHeader";

const members = [
  { userId: "user-a", displayName: "Priya Shah", role: "owner" },
  { userId: "user-b", displayName: "Sam Cole", role: "editor" },
];

const stories = [
  { id: "story-a", title: "Launch prep", workType: "story" },
  { id: "story-b", title: "Billing", workType: "story" },
];

const baseProps = (overrides = {}) => ({
  userId: "user-a",
  project: {
    id: "project-a",
    name: "Launch",
    description: "Coordinate release work",
    color: "#5b5bd6",
    viewerRole: "owner",
    status: "active",
  },
  members,
  stories,
  tab: "board",
  onTabChange: vi.fn(),
  canEdit: true,
  onNewTask: vi.fn(),
  onNewStory: vi.fn(),
  onUpdateProject: vi.fn().mockResolvedValue(undefined),
  onDeleteProject: vi.fn().mockResolvedValue(undefined),
  onBack: vi.fn(),
  ...overrides,
});

const byName = (tree, name) =>
  find(tree, (node) => typeof node.type === "function" && node.type.name === name);

const menuItems = (tree) => props(byName(tree, "Menu")).items ?? [];

const menuItem = (tree, id) => menuItems(tree).find((item) => item.id === id);

const buttonLabels = (tree) =>
  findAll(render(tree, 4), (node) => node.type === "button" && !props(node)["aria-label"]).map(
    (node) => textContent(node).trim()
  );

const mount = (overrides = {}) => {
  const componentProps = baseProps(overrides);
  const runner = runtime.createRunner(ProjectHeader, componentProps);
  runner.render(componentProps);
  return { runner, componentProps };
};

const runners = new Set();

beforeEach(() => {
  dialogCalls.project.length = 0;
  dialogCalls.members.length = 0;
  vi.stubGlobal("location", { href: "https://taskflow.test/projects/project-a/board" });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  for (const runner of runners) runner.unmount();
  runners.clear();
  vi.unstubAllGlobals();
});

describe("ProjectHeader", () => {
  it("renders the project identity and the four section tabs with a story count", () => {
    const { runner } = mount();
    runners.add(runner);

    expect(textContent(runner.output)).toContain("Launch");
    expect(textContent(runner.output)).toContain("Coordinate release work");

    const tabs = props(byName(runner.output, "Tabs"));
    expect(tabs.items.map((item) => item.id)).toEqual(["overview", "board", "list", "stories"]);
    expect(tabs.items.map((item) => item.label)).toEqual([
      "Overview",
      "Board",
      "List",
      "Stories",
    ]);
    expect(tabs.items.at(-1).count).toBe(2);
    expect(tabs.value).toBe("board");

    tabs.onChange("list");
    expect(runner.props.onTabChange).toHaveBeenCalledWith("list");
  });

  it("labels the members button Invite for owners and Members for everyone else", () => {
    const owner = mount();
    runners.add(owner.runner);
    expect(buttonLabels(owner.runner.output)).toContain("Invite");

    const editor = mount({
      project: { ...baseProps().project, viewerRole: "editor" },
    });
    runners.add(editor.runner);
    expect(buttonLabels(editor.runner.output)).toContain("Members");
  });

  it("switches the create button to New story on the Stories tab", () => {
    const { runner, componentProps } = mount({ tab: "stories" });
    runners.add(runner);

    const create = find(
      render(runner.output, 4),
      (node) => node.type === "button" && textContent(node).trim() === "New story"
    );
    expect(create).toBeDefined();
    create.props.onClick();
    expect(componentProps.onNewStory).toHaveBeenCalled();
    expect(componentProps.onNewTask).not.toHaveBeenCalled();
  });

  it("marks viewers as read-only and hides the create button", () => {
    const { runner } = mount({
      canEdit: false,
      project: { ...baseProps().project, viewerRole: "viewer" },
    });
    runners.add(runner);

    expect(textContent(runner.output)).toContain("View only");
    expect(buttonLabels(runner.output)).not.toContain("New task");
  });

  it("opens the members modal from the avatar stack and the members button", () => {
    const { runner, componentProps } = mount();
    runners.add(runner);

    expect(dialogCalls.members).toHaveLength(0);
    const stack = find(runner.output, (node) => props(node).className === "workspace-members");
    expect(props(stack)["aria-label"]).toBe("Members, 2");

    stack.props.onClick({ currentTarget: { focus: vi.fn() } });
    runner.render(componentProps);
    render(runner.output, 4);

    expect(dialogCalls.members.at(-1)).toEqual(
      expect.objectContaining({ userId: "user-a", project: componentProps.project })
    );
  });

  it("archives and restores the project from the owner menu", async () => {
    const active = mount();
    runners.add(active.runner);

    expect(menuItem(active.runner.output, "archive").label).toBe("Archive project");
    menuItem(active.runner.output, "archive").onSelect();
    await Promise.resolve();
    expect(active.componentProps.onUpdateProject).toHaveBeenCalledWith("project-a", {
      status: "archived",
    });

    const archived = mount({
      project: { ...baseProps().project, status: "archived" },
    });
    runners.add(archived.runner);
    expect(textContent(archived.runner.output)).toContain("Archived");
    expect(menuItem(archived.runner.output, "archive").label).toBe("Restore project");
    menuItem(archived.runner.output, "archive").onSelect();
    await Promise.resolve();
    expect(archived.componentProps.onUpdateProject).toHaveBeenCalledWith("project-a", {
      status: "active",
    });
  });

  it("edits the project through ProjectDialog", async () => {
    const { runner, componentProps } = mount();
    runners.add(runner);
    render(runner.output, 4);
    expect(dialogCalls.project.at(-1).open).toBe(false);

    menuItem(runner.output, "edit").onSelect();
    runner.render(componentProps);
    render(runner.output, 4);
    expect(dialogCalls.project.at(-1)).toEqual(
      expect.objectContaining({ open: true, project: componentProps.project })
    );

    await dialogCalls.project.at(-1).onSubmit({ name: "Launch v2", color: "#1f9d64" });
    expect(componentProps.onUpdateProject).toHaveBeenCalledWith("project-a", {
      name: "Launch v2",
      color: "#1f9d64",
    });
  });

  it("deletes the project after confirmation and navigates back", async () => {
    const { runner, componentProps } = mount();
    runners.add(runner);

    expect(props(byName(runner.output, "ConfirmDialog")).open).toBe(false);
    menuItem(runner.output, "delete").onSelect();
    runner.render(componentProps);

    const confirm = props(byName(runner.output, "ConfirmDialog"));
    expect(confirm.open).toBe(true);
    expect(confirm.danger).toBe(true);
    await confirm.onConfirm();

    expect(componentProps.onDeleteProject).toHaveBeenCalledWith("project-a");
    expect(componentProps.onBack).toHaveBeenCalled();
  });

  it("reports a failed delete instead of navigating away", async () => {
    const { runner, componentProps } = mount({
      onDeleteProject: vi.fn().mockRejectedValue(new Error("Delete blocked by policy.")),
    });
    runners.add(runner);

    menuItem(runner.output, "delete").onSelect();
    runner.render(componentProps);
    await props(byName(runner.output, "ConfirmDialog")).onConfirm();
    runner.render(componentProps);

    expect(componentProps.onBack).not.toHaveBeenCalled();
    expect(textContent(render(runner.output, 4))).toContain("Delete blocked by policy.");
  });

  it("copies the workspace link", () => {
    const { runner } = mount();
    runners.add(runner);

    menuItem(runner.output, "copy").onSelect();
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://taskflow.test/projects/project-a/board"
    );
  });

  it("offers only Copy link to non-owners", () => {
    const { runner } = mount({
      project: { ...baseProps().project, viewerRole: "editor" },
    });
    runners.add(runner);

    expect(menuItems(runner.output).map((item) => item.id)).toEqual(["copy"]);
  });
});
