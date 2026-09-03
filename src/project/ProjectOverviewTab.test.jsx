import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const overviewService = vi.hoisted(() => ({
  projectOverviewService: { load: vi.fn(), updateHealth: vi.fn() },
}));

vi.mock("../application/projectOverviewService", () => overviewService);

import { find, findAll, findByText, props, render, textContent } from "../test/elementTree";
import { ProjectOverviewTab } from "./ProjectOverviewTab";

const { projectOverviewService } = overviewService;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const hasClass = (node, className) =>
  String(props(node).className || "").split(" ").includes(className);

const overview = (overrides = {}) => ({
  project: {
    id: "project-1",
    name: "Launch",
    description: "Ship TaskFlow",
    healthStatus: "on_track",
    healthSupported: true,
    viewerRole: "editor",
    ...(overrides.project || {}),
  },
  metrics: { total: 8, completed: 3, inProgress: 2, overdue: 1 },
  statusDistribution: { done: 3, todo: 3, in_progress: 2 },
  overdueTasks: [
    {
      id: "late",
      title: "Fix launch blocker",
      status: "todo",
      dueDate: "2026-08-20",
      assigneeId: "user-b",
      assigneeName: "Asha Rao",
    },
  ],
  recentlyCompletedTasks: [
    {
      id: "shipped",
      title: "Publish docs",
      status: "done",
      completedAt: "2026-08-21",
      assigneeId: null,
      assigneeName: "Unassigned",
    },
  ],
  ...overrides,
});

const baseProps = (overrides = {}) => ({
  userId: "user-a",
  projectId: "project-1",
  project: { id: "project-1", dueDate: "2026-10-01", createdAt: "2026-07-04T10:00:00.000Z" },
  onOpenTask: vi.fn(),
  members: [{ userId: "user-a", displayName: "Priya Shah", role: "owner" }],
  ...overrides,
});

/** Renders, waits for the load promise, then renders again with the data in place. */
const mount = async (componentProps) => {
  const runner = runtime.createRunner(ProjectOverviewTab);
  runner.render(componentProps);
  await flush();
  return { runner, tree: render(runner.render()) };
};

const healthSelect = (tree) =>
  find(tree, (node) => props(node)["aria-label"] === "Project health");

beforeEach(() => {
  projectOverviewService.load.mockReset().mockResolvedValue(overview());
  projectOverviewService.updateHealth.mockReset().mockResolvedValue(undefined);
});

describe("ProjectOverviewTab", () => {
  it("shows a loading state before the overview resolves", async () => {
    const runner = runtime.createRunner(ProjectOverviewTab);
    const loading = render(runner.render(baseProps()));

    expect(props(loading)["aria-label"]).toBe("Loading project overview");
    expect(projectOverviewService.load).toHaveBeenCalledWith("user-a", "project-1");

    await flush();
  });

  it("charts the status distribution in a stable order", async () => {
    const { tree } = await mount(baseProps());
    const bars = findAll(tree, (node) => hasClass(node, "bar-row"));

    expect(bars.map((bar) => textContent(bar))).toEqual([
      "To do 3",
      "In progress 2",
      "Done 3",
    ]);
    expect(props(find(bars[0], (node) => hasClass(node, "progress-fill"))).className).toContain(
      "is-todo"
    );
  });

  it("opens an overdue task from its row", async () => {
    const componentProps = baseProps();
    const { tree } = await mount(componentProps);
    const row = find(tree, (node) => hasClass(node, "overview-task-row"));

    expect(textContent(row)).toContain("Fix launch blocker");
    expect(textContent(row)).toContain("Asha Rao");

    row.props.onClick();
    expect(componentProps.onOpenTask).toHaveBeenCalledWith("late");

    const preventDefault = vi.fn();
    row.props.onKeyDown({ key: "Enter", preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(componentProps.onOpenTask).toHaveBeenCalledTimes(2);

    row.props.onKeyDown({ key: "Tab", preventDefault: vi.fn() });
    expect(componentProps.onOpenTask).toHaveBeenCalledTimes(2);
  });

  it("lists recently completed work without an avatar for unassigned tasks", async () => {
    const { tree } = await mount(baseProps());
    const rows = findAll(tree, (node) => hasClass(node, "overview-task-row"));
    const completed = rows[1];

    expect(textContent(completed)).toContain("Publish docs");
    expect(textContent(completed)).toContain("Unassigned");
    expect(find(completed, (node) => hasClass(node, "avatar"))).toBeUndefined();
  });

  it("lets editors change health but shows viewers a badge", async () => {
    const { tree: editorTree } = await mount(baseProps());
    expect(props(healthSelect(editorTree)).value).toBe("on_track");

    projectOverviewService.load.mockResolvedValue(
      overview({ project: { viewerRole: "viewer" } })
    );
    const { tree: viewerTree } = await mount(baseProps());
    expect(healthSelect(viewerTree)).toBeUndefined();
    expect(textContent(viewerTree)).toContain("On track");
  });

  it("hides the health control while the migration is pending", async () => {
    projectOverviewService.load.mockResolvedValue(
      overview({ project: { healthSupported: false } })
    );
    const { tree } = await mount(baseProps());

    expect(healthSelect(tree)).toBeUndefined();
    expect(textContent(tree)).toContain("migration 017");
    expect(textContent(tree)).toContain("Fix launch blocker");
  });

  it("applies a health change optimistically and reverts it when the save fails", async () => {
    projectOverviewService.updateHealth.mockRejectedValue(new Error("Health didn’t save."));
    const { runner } = await mount(baseProps());

    healthSelect(render(runner.render())).props.onChange({ target: { value: "at_risk" } });

    const saving = healthSelect(render(runner.render()));
    expect(saving.props.value).toBe("at_risk");
    expect(saving.props.disabled).toBe(true);
    expect(projectOverviewService.updateHealth).toHaveBeenCalledWith("project-1", "at_risk");

    await flush();
    const reverted = render(runner.render());
    expect(healthSelect(reverted).props.value).toBe("on_track");
    expect(healthSelect(reverted).props.disabled).toBe(false);
    expect(textContent(reverted)).toContain("Health didn’t save.");
  });

  it("keeps a successful health change and shows no error", async () => {
    const { runner } = await mount(baseProps());

    healthSelect(render(runner.render())).props.onChange({ target: { value: "at_risk" } });
    await flush();
    const tree = render(runner.render());

    expect(healthSelect(tree).props.value).toBe("at_risk");
    expect(find(tree, (node) => props(node).role === "alert")).toBeUndefined();
  });

  it("shows project details and caps the member list at eight", async () => {
    const members = Array.from({ length: 10 }, (_, index) => ({
      userId: `user-${index}`,
      displayName: `Member ${index}`,
      role: index === 0 ? "owner" : "editor",
    }));
    const { tree } = await mount(baseProps({ members }));

    expect(textContent(tree)).toContain("Ship TaskFlow");
    expect(findAll(tree, (node) => hasClass(node, "overview-member"))).toHaveLength(8);
    expect(textContent(tree)).toContain("+2 more");
    expect(textContent(tree)).toContain("Owner");
  });

  it("offers a retry when the overview fails to load", async () => {
    projectOverviewService.load.mockRejectedValueOnce(new Error("Overview unavailable."));
    const { runner, tree } = await mount(baseProps());

    expect(textContent(tree)).toContain("Overview unavailable.");
    projectOverviewService.load.mockResolvedValue(overview());

    findByText(tree, "Retry").props.onClick();
    await flush();

    expect(projectOverviewService.load).toHaveBeenCalledTimes(2);
    expect(textContent(render(runner.render()))).toContain("Fix launch blocker");
  });

  it("explains when the project is not visible to the viewer", async () => {
    projectOverviewService.load.mockResolvedValue(null);
    const { tree } = await mount(baseProps());

    expect(textContent(tree)).toContain("You don’t have access");
  });
});
