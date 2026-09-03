import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

vi.mock("../tasks", () => ({
  BulkActionBar: () => null,
  QuickAdd: () => null,
  QuickAddTrigger: () => null,
  TaskRow: () => null,
}));

import { BulkActionBar, QuickAdd, QuickAddTrigger, TaskRow } from "../tasks";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import { ProjectListTab } from "./ProjectListTab";

const columns = [
  { id: "todo", name: "To do", category: "todo" },
  { id: "doing", name: "Doing", category: "in_progress" },
];

const members = [
  { userId: "user-a", displayName: "Priya Shah" },
  { userId: "user-b", displayName: "Sam Cole" },
];

const stories = [{ id: "story-a", title: "Launch prep", workType: "story" }];

const tasks = [
  {
    id: "task-a",
    title: "Plan launch",
    status: "todo",
    columnId: "todo",
    storyId: "story-a",
    assigneeId: "user-a",
  },
  {
    id: "task-b",
    title: "Ship launch",
    status: "in-progress",
    columnId: "doing",
    storyId: null,
    assigneeId: null,
  },
];

const baseProps = (overrides = {}) => ({
  tasks,
  stories,
  members,
  columns,
  context: { projectsById: new Map(), membersById: new Map() },
  group: "story",
  onOpen: vi.fn(),
  onToggleComplete: vi.fn(),
  onArchive: vi.fn(),
  onCreate: vi.fn().mockResolvedValue(undefined),
  onOpenComposer: vi.fn(),
  readOnly: false,
  selectedTaskId: null,
  pendingIds: new Set(),
  selectable: false,
  selectedIds: new Set(),
  allSelected: false,
  onToggleSelect: vi.fn(),
  onToggleAll: vi.fn(),
  bulkBusy: false,
  bulkMessage: null,
  currentStoryId: null,
  onBulkAction: vi.fn(),
  onClearSelection: vi.fn(),
  hasTasks: true,
  onClearFilters: vi.fn(),
  todayKey: "2026-09-02",
  ...overrides,
});

const runners = new Set();

const mount = (overrides = {}) => {
  const componentProps = baseProps(overrides);
  const runner = runtime.createRunner(ProjectListTab, componentProps);
  runner.render(componentProps);
  runners.add(runner);
  return { runner, componentProps };
};

const sections = (tree) =>
  findAll(tree, (node) => String(props(node).className || "").includes("workspace-section") && node.type === "section");

const sectionTitles = (tree) =>
  sections(tree).map((section) => textContent(find(section, (node) => node.type === "h3")));

const rows = (tree) => findAll(tree, (node) => node.type === TaskRow);

afterEach(() => {
  for (const runner of runners) runner.unmount();
  runners.clear();
});

describe("ProjectListTab", () => {
  it("groups by story with a No story section and counts each one", () => {
    const { runner } = mount();

    expect(sectionTitles(runner.output)).toEqual(["Launch prep", "No story"]);
    expect(rows(runner.output).map((row) => props(row).task.id)).toEqual(["task-a", "task-b"]);
    expect(props(rows(runner.output)[0]).showProject).toBe(false);
    expect(props(rows(runner.output)[0]).showStory).toBe(false);
    expect(textContent(sections(runner.output)[0])).toContain("1");
  });

  it("groups by status, assignee or not at all", () => {
    expect(sectionTitles(mount({ group: "status" }).runner.output)).toEqual(["To do", "Doing"]);
    expect(sectionTitles(mount({ group: "assignee" }).runner.output)).toEqual([
      "Priya Shah",
      "Sam Cole",
      "Unassigned",
    ]);

    const flat = mount({ group: "none" }).runner;
    expect(sectionTitles(flat.output)).toEqual(["All tasks"]);
    expect(props(rows(flat.output)[0]).showStory).toBe(true);
  });

  it("shows No tasks in an empty section", () => {
    const { runner } = mount({ group: "assignee" });

    const sam = sections(runner.output)[1];
    expect(textContent(sam)).toContain("Sam Cole");
    expect(textContent(sam)).toContain("No tasks");

    const priya = sections(runner.output)[0];
    expect(textContent(priya)).not.toContain("No tasks");
  });

  it("creates from a section quick add with that section's story", async () => {
    const { runner, componentProps } = mount();

    const trigger = findAll(runner.output, (node) => node.type === QuickAddTrigger)[0];
    trigger.props.onClick();
    runner.render(componentProps);

    const quickAdd = find(runner.output, (node) => node.type === QuickAdd);
    expect(props(quickAdd).contextLabel).toBe("Launch prep");
    await props(quickAdd).onCreate("Write release notes");
    expect(componentProps.onCreate).toHaveBeenCalledWith("Write release notes", {
      storyId: "story-a",
    });
  });

  it("creates with the section column when grouped by status", async () => {
    const { runner, componentProps } = mount({ group: "status" });

    findAll(runner.output, (node) => node.type === QuickAddTrigger)[1].props.onClick();
    runner.render(componentProps);

    await props(find(runner.output, (node) => node.type === QuickAdd)).onCreate("Review");
    expect(componentProps.onCreate).toHaveBeenCalledWith("Review", { column: columns[1] });
  });

  it("hands the typed title to the composer from Add details", () => {
    const { runner, componentProps } = mount({ group: "assignee" });

    findAll(runner.output, (node) => node.type === QuickAddTrigger)[0].props.onClick();
    runner.render(componentProps);

    props(find(runner.output, (node) => node.type === QuickAdd)).onOpenDetails("Draft copy");
    expect(componentProps.onOpenComposer).toHaveBeenCalledWith({
      title: "Draft copy",
      assigneeId: "user-a",
    });
  });

  it("collapses a section without losing its count", () => {
    const { runner, componentProps } = mount();

    const collapse = find(
      render(runner.output, 3),
      (node) => props(node)["aria-label"] === "Collapse Launch prep"
    );
    collapse.props.onClick();
    runner.render(componentProps);

    expect(rows(runner.output).map((row) => props(row).task.id)).toEqual(["task-b"]);
    expect(textContent(sections(runner.output)[0])).toContain("1");
    expect(
      find(render(runner.output, 3), (node) => props(node)["aria-label"] === "Expand Launch prep")
    ).toBeDefined();
  });

  it("hides every mutation for read-only viewers", () => {
    const { runner } = mount({ readOnly: true });

    expect(find(runner.output, (node) => node.type === QuickAddTrigger)).toBeUndefined();
    expect(props(rows(runner.output)[0]).onToggleComplete).toBeUndefined();
    expect(props(rows(runner.output)[0]).onArchive).toBeUndefined();
    expect(props(rows(runner.output)[0]).readOnly).toBe(true);
  });

  it("offers a filter reset when the project has tasks but none match", () => {
    const { runner, componentProps } = mount({ tasks: [], hasTasks: true });

    const tree = render(runner.output, 4);
    expect(textContent(tree)).toContain("No tasks match these filters");
    find(tree, (node) => node.type === "button" && textContent(node).trim() === "Clear filters")
      .props.onClick();
    expect(componentProps.onClearFilters).toHaveBeenCalled();
  });

  it("offers the composer when the project has no tasks at all", () => {
    const { runner, componentProps } = mount({ tasks: [], hasTasks: false });

    const tree = render(runner.output, 4);
    expect(textContent(tree)).toContain("No tasks yet");
    find(tree, (node) => node.type === "button" && textContent(node).trim() === "New task")
      .props.onClick();
    expect(componentProps.onOpenComposer).toHaveBeenCalledWith({});
  });

  it("shows the bulk strip only while selection is enabled", () => {
    expect(find(mount().runner.output, (node) => node.type === BulkActionBar)).toBeUndefined();

    const { runner } = mount({
      selectable: true,
      selectedIds: new Set(["task-a"]),
      currentStoryId: "story-a",
    });
    expect(props(find(runner.output, (node) => node.type === BulkActionBar))).toEqual(
      expect.objectContaining({ selectedCount: 1, currentStoryId: "story-a" })
    );
    expect(props(rows(runner.output)[0]).selectable).toBe(true);
    expect(props(rows(runner.output)[0]).selectedForBulk).toBe(true);
  });
});
