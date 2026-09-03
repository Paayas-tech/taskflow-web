import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const projectService = vi.hoisted(() => ({
  archiveProjectTask: vi.fn(),
  createProjectTask: vi.fn(),
  deleteProjectTask: vi.fn(),
  reorderProjectTasks: vi.fn(),
  setTaskAssignee: vi.fn(),
  updateProjectTask: vi.fn(),
}));

const workspaceLoader = vi.hoisted(() => ({ consumeProjectWorkspace: vi.fn() }));

const attachmentService = vi.hoisted(() => ({
  getTaskCounts: vi.fn(),
  removeAll: vi.fn(),
}));

vi.mock("../application/projectService", () => projectService);
vi.mock("../application/projectWorkspaceLoader", () => workspaceLoader);
vi.mock("../application/attachmentService", () => ({ attachmentService }));

vi.mock("../tasks", () => ({
  TaskComposerDialog: () => null,
  TaskDetailPanel: () => null,
  TaskFilterBar: () => null,
}));

vi.mock("../project/ProjectHeader", () => ({ default: () => null }));
vi.mock("../project/ProjectBoardTab", () => ({ default: () => null }));
vi.mock("../project/ProjectListTab", () => ({ default: () => null }));
vi.mock("../project/ProjectOverviewTab", () => ({ default: () => null }));
vi.mock("../project/ProjectStoriesTab", () => ({ default: () => null }));

import ProjectBoardTab from "../project/ProjectBoardTab";
import ProjectHeader from "../project/ProjectHeader";
import ProjectListTab from "../project/ProjectListTab";
import ProjectOverviewTab from "../project/ProjectOverviewTab";
import ProjectStoriesTab from "../project/ProjectStoriesTab";
import { TaskComposerDialog, TaskDetailPanel, TaskFilterBar } from "../tasks";
import { find, props, render, textContent } from "../test/elementTree";
import ProjectWorkspacePage from "./ProjectWorkspacePage";

const columns = [
  { id: "todo", name: "To do", category: "todo" },
  { id: "doing", name: "Doing", category: "in_progress" },
  { id: "done", name: "Done", category: "done" },
];

const story = {
  id: "story-a",
  title: "Launch prep",
  workType: "story",
  status: "todo",
  createdAt: "2026-08-20T09:00:00.000Z",
};

const tasks = [
  {
    id: "task-a",
    title: "Plan launch",
    workType: "task",
    columnId: "todo",
    position: 0,
    status: "todo",
    completed: false,
    storyId: "story-a",
    assigneeId: null,
    createdAt: "2026-08-22T09:00:00.000Z",
  },
  {
    id: "task-b",
    title: "Ship launch",
    workType: "task",
    columnId: "doing",
    position: 0,
    status: "in-progress",
    completed: false,
    storyId: null,
    assigneeId: "member-a",
    createdAt: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "task-archived",
    title: "Archived task",
    workType: "task",
    columnId: "done",
    position: 0,
    status: "completed",
    completed: true,
    archivedAt: "2026-08-22T11:00:00.000Z",
  },
];

const members = [
  { userId: "user-a", displayName: "Priya Shah", role: "owner" },
  { userId: "member-a", displayName: "Sam Cole", role: "editor" },
];

const project = {
  id: "project-a",
  name: "Launch",
  description: "Coordinate release work",
  viewerRole: "owner",
  status: "active",
};

const baseProps = (overrides = {}) => ({
  userId: "user-a",
  projectId: "project-a",
  project,
  projects: [project],
  projectsLoading: false,
  projectsError: "",
  onRetryProjects: vi.fn(),
  tab: "board",
  onTabChange: vi.fn(),
  openItemRequest: null,
  refreshToken: 0,
  onProjectTasksChanged: vi.fn(),
  onUpdateProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onBack: vi.fn(),
  formatSettings: {},
  browserNotificationsEnabled: false,
  defaultReminderMinutes: 15,
  ...overrides,
});

const runners = new Set();

const mount = (overrides = {}) => {
  const componentProps = baseProps(overrides);
  const runner = runtime.createRunner(ProjectWorkspacePage, componentProps);
  runner.render(componentProps);
  runners.add(runner);
  return { runner, componentProps };
};

async function flush(runner, componentProps) {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
  return runner.render(componentProps ?? runner.props);
}

const byType = (tree, type) => find(tree, (node) => node.type === type);
const propsOf = (tree, type) => props(byType(tree, type));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  workspaceLoader.consumeProjectWorkspace
    .mockReset()
    .mockResolvedValue({ tasks: [story, ...tasks], columns, members });
  attachmentService.getTaskCounts.mockReset().mockResolvedValue({});
  attachmentService.removeAll.mockReset().mockResolvedValue(undefined);
  projectService.archiveProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.createProjectTask.mockReset().mockResolvedValue({ id: "created-task" });
  projectService.deleteProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.reorderProjectTasks.mockReset().mockResolvedValue(undefined);
  projectService.setTaskAssignee.mockReset().mockResolvedValue(undefined);
  projectService.updateProjectTask.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const runner of runners) runner.unmount();
  runners.clear();
  vi.restoreAllMocks();
});

describe("ProjectWorkspacePage loading and guard states", () => {
  it("shows a loading placeholder while the project record is still loading", () => {
    const { runner } = mount({ project: null, projectsLoading: true });

    expect(textContent(render(runner.output, 4))).toContain("Loading project…");
    expect(byType(runner.output, ProjectHeader)).toBeUndefined();
  });

  it("offers a retry when the project list failed to load", () => {
    const { runner, componentProps } = mount({ project: null, projectsError: "Projects offline." });

    const tree = render(runner.output, 4);
    expect(textContent(tree)).toContain("Projects offline.");
    find(tree, (node) => node.type === "button" && textContent(node).trim() === "Try again")
      .props.onClick();
    expect(componentProps.onRetryProjects).toHaveBeenCalled();
  });

  it("explains a missing project and links back to the project list", () => {
    const { runner, componentProps } = mount({ project: null });

    const tree = render(runner.output, 4);
    expect(textContent(tree)).toContain("Project not found");
    find(tree, (node) => node.type === "button" && textContent(node).trim() === "Back to projects")
      .props.onClick();
    expect(componentProps.onBack).toHaveBeenCalled();
  });

  it("shows a sanitized workspace failure and retries the load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    workspaceLoader.consumeProjectWorkspace
      .mockRejectedValueOnce(new Error("sensitive provider failure"))
      .mockResolvedValueOnce({ tasks: [story, ...tasks], columns, members });
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    const tree = render(runner.output, 4);
    expect(textContent(tree)).toContain(
      "We couldn't load this project workspace. Check your connection and try again."
    );
    expect(textContent(tree)).not.toContain("sensitive provider failure");

    find(tree, (node) => node.type === "button" && textContent(node).trim() === "Try again")
      .props.onClick();
    await flush(runner, componentProps);

    expect(workspaceLoader.consumeProjectWorkspace).toHaveBeenCalledTimes(2);
    expect(propsOf(runner.output, ProjectBoardTab).tasks.map((task) => task.id)).toEqual([
      "task-a",
      "task-b",
    ]);
  });

  it("ignores a stale workspace response after switching projects", async () => {
    const first = deferred();
    workspaceLoader.consumeProjectWorkspace
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        tasks: [{ ...tasks[1], id: "task-new", title: "New workspace" }],
        columns,
        members,
      });

    const { runner } = mount();
    const nextProject = { ...project, id: "project-b", name: "Next project" };
    const nextProps = baseProps({
      projectId: "project-b",
      project: nextProject,
      projects: [nextProject],
    });
    runner.render(nextProps);
    await flush(runner, nextProps);

    expect(workspaceLoader.consumeProjectWorkspace).toHaveBeenNthCalledWith(2, "user-a", "project-b");
    expect(propsOf(runner.output, ProjectBoardTab).tasks.map((task) => task.id)).toEqual(["task-new"]);

    first.resolve({ tasks: [{ ...tasks[0], id: "task-stale" }], columns, members });
    await flush(runner, nextProps);
    expect(propsOf(runner.output, ProjectBoardTab).tasks.map((task) => task.id)).toEqual(["task-new"]);
  });

  it("accepts a workspaceLoader override for the dev preview", async () => {
    const previewLoader = vi.fn().mockResolvedValue({ tasks: [story, ...tasks], columns, members });
    const { runner, componentProps } = mount({ workspaceLoader: previewLoader });
    await flush(runner, componentProps);

    expect(previewLoader).toHaveBeenCalledWith("user-a", "project-a");
    expect(workspaceLoader.consumeProjectWorkspace).not.toHaveBeenCalled();
  });
});

describe("ProjectWorkspacePage tabs", () => {
  it("renders the tab named by the tab prop and forwards tab changes", async () => {
    const { runner, componentProps } = mount({ tab: "overview" });
    await flush(runner, componentProps);

    expect(byType(runner.output, ProjectBoardTab)).toBeUndefined();
    expect(propsOf(runner.output, ProjectOverviewTab)).toEqual(
      expect.objectContaining({ userId: "user-a", projectId: "project-a", project, members })
    );
    expect(propsOf(runner.output, ProjectHeader).onTabChange).toBe(componentProps.onTabChange);
    expect(byType(runner.output, TaskFilterBar)).toBeUndefined();
  });

  it("passes active and archived stories to the Stories tab", async () => {
    const archivedStory = { ...story, id: "story-old", title: "Old", archivedAt: "2026-08-01T00:00:00.000Z" };
    workspaceLoader.consumeProjectWorkspace.mockResolvedValue({
      tasks: [story, archivedStory, ...tasks],
      columns,
      members,
    });
    const { runner, componentProps } = mount({ tab: "stories" });
    await flush(runner, componentProps);

    const storiesTab = propsOf(runner.output, ProjectStoriesTab);
    expect(storiesTab.stories.map((item) => item.id)).toEqual(["story-a"]);
    expect(storiesTab.archivedStories.map((item) => item.id)).toEqual(["story-old"]);
    expect(storiesTab.readOnly).toBe(false);

    await storiesTab.onRestoreStory("story-old");
    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "story-old",
      { archivedAt: null }
    );
    expect(componentProps.onProjectTasksChanged).toHaveBeenCalled();
  });

  it("shows the filter bar on Board and List only, with status, group and sort on List", async () => {
    const board = mount({ tab: "board" });
    await flush(board.runner, board.componentProps);
    const boardFilters = propsOf(board.runner.output, TaskFilterBar);
    expect(boardFilters.filters.map((filter) => filter.label)).toEqual(["Story", "Assignee"]);
    expect(boardFilters.group).toBeUndefined();
    expect(boardFilters.sort).toBeUndefined();

    const list = mount({ tab: "list" });
    await flush(list.runner, list.componentProps);
    const listFilters = propsOf(list.runner.output, TaskFilterBar);
    expect(listFilters.filters.map((filter) => filter.label)).toEqual([
      "Story",
      "Assignee",
      "Status",
    ]);
    expect(listFilters.group.value).toBe("story");
    expect(listFilters.sort.value).toBe("created");
    expect(listFilters.filters[0].options.map((option) => option.value)).toEqual([
      "all",
      "none",
      "story-a",
    ]);
  });
});

describe("ProjectWorkspacePage filtering", () => {
  it("narrows the board by story, assignee and search", async () => {
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);
    const filterBar = () => propsOf(runner.output, TaskFilterBar);
    const boardTaskIds = () =>
      propsOf(runner.output, ProjectBoardTab).tasks.map((task) => task.id);

    expect(boardTaskIds()).toEqual(["task-a", "task-b"]);

    filterBar().filters[0].onChange("story-a");
    runner.render(componentProps);
    expect(boardTaskIds()).toEqual(["task-a"]);
    expect(filterBar().activeCount).toBe(1);

    filterBar().filters[0].onChange("none");
    runner.render(componentProps);
    expect(boardTaskIds()).toEqual(["task-b"]);

    filterBar().filters[0].onChange("all");
    filterBar().filters[1].onChange("member-a");
    runner.render(componentProps);
    expect(boardTaskIds()).toEqual(["task-b"]);

    filterBar().filters[1].onChange("all");
    filterBar().onSearch("Plan");
    runner.render(componentProps);
    expect(boardTaskIds()).toEqual(["task-a"]);

    filterBar().onClear();
    runner.render(componentProps);
    expect(boardTaskIds()).toEqual(["task-a", "task-b"]);
    expect(filterBar().activeCount).toBe(0);
  });

  it("filters the list by task status", async () => {
    const { runner, componentProps } = mount({ tab: "list" });
    await flush(runner, componentProps);

    propsOf(runner.output, TaskFilterBar).filters[2].onChange("in-progress");
    runner.render(componentProps);

    expect(propsOf(runner.output, ProjectListTab).tasks.map((task) => task.id)).toEqual(["task-b"]);
  });

  it("enables bulk selection only while one story is filtered", async () => {
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    expect(propsOf(runner.output, ProjectBoardTab).selectable).toBe(false);

    propsOf(runner.output, TaskFilterBar).filters[0].onChange("story-a");
    runner.render(componentProps);
    runner.render(componentProps);
    expect(propsOf(runner.output, ProjectBoardTab).selectable).toBe(true);

    propsOf(runner.output, ProjectBoardTab).onToggleSelect("task-a");
    runner.render(componentProps);
    expect([...propsOf(runner.output, ProjectBoardTab).selectedIds]).toEqual(["task-a"]);

    propsOf(runner.output, TaskFilterBar).filters[0].onChange("all");
    runner.render(componentProps);
    runner.render(componentProps);
    expect(propsOf(runner.output, ProjectBoardTab).selectable).toBe(false);
    expect(propsOf(runner.output, ProjectBoardTab).selectedIds.size).toBe(0);
  });
});

describe("ProjectWorkspacePage mutations", () => {
  it("creates a board task in the target column and inherits the story filter", async () => {
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    propsOf(runner.output, TaskFilterBar).filters[0].onChange("story-a");
    runner.render(componentProps);

    await propsOf(runner.output, ProjectBoardTab).onQuickCreate("  Review release  ", columns[1]);

    expect(projectService.createProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      expect.objectContaining({
        title: "Review release",
        projectId: "project-a",
        listId: null,
        status: "in-progress",
        workType: "task",
        storyId: "story-a",
      })
    );
    expect(projectService.setTaskAssignee).not.toHaveBeenCalled();
    expect(componentProps.onProjectTasksChanged).toHaveBeenCalled();
  });

  it("creates a list task with the section story and assignee", async () => {
    const { runner, componentProps } = mount({ tab: "list" });
    await flush(runner, componentProps);

    await propsOf(runner.output, ProjectListTab).onCreate("Write notes", {
      storyId: "story-a",
      assigneeId: "member-a",
    });

    expect(projectService.createProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      expect.objectContaining({ title: "Write notes", status: "todo", storyId: "story-a" })
    );
    expect(projectService.setTaskAssignee).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "created-task",
      "member-a"
    );
  });

  it("creates from the composer and reports a failed assignee without losing the task", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    projectService.setTaskAssignee.mockRejectedValueOnce(new Error("denied"));
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    await propsOf(runner.output, TaskComposerDialog).onSubmit({
      title: " Draft plan ",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: "member-a",
      workType: "task",
    });
    runner.render(componentProps);

    const createPayload = projectService.createProjectTask.mock.calls[0][2];
    expect(createPayload).not.toHaveProperty("assigneeId");
    expect(createPayload.title).toBe("Draft plan");
    expect(textContent(render(runner.output, 4))).toContain(
      "was created, but its assignee could not be saved"
    );
  });

  it("sanitizes a failed create for the composer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    projectService.createProjectTask.mockRejectedValueOnce(new Error("raw provider detail"));
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    await expect(
      propsOf(runner.output, TaskComposerDialog).onSubmit({ title: "Draft", workType: "story" })
    ).rejects.toThrow("We couldn't create this story. Check your connection and try again.");
  });

  it("optimistically maps board moves to column status and persists them", async () => {
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    const placements = [
      { taskId: "task-a", columnId: "done", position: 0 },
      { taskId: "task-b", columnId: "todo", position: 1 },
    ];
    await propsOf(runner.output, ProjectBoardTab).onMove(placements);
    runner.render(componentProps);

    expect(projectService.reorderProjectTasks).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      placements
    );
    expect(propsOf(runner.output, ProjectBoardTab).tasks).toEqual([
      expect.objectContaining({ id: "task-a", columnId: "done", status: "completed", completed: true }),
      expect.objectContaining({ id: "task-b", columnId: "todo", status: "todo", completed: false }),
    ]);
    expect(componentProps.onProjectTasksChanged).toHaveBeenCalled();
  });

  it("restores the board and shows a sanitized notice when a move fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    projectService.reorderProjectTasks.mockRejectedValue(new Error("raw database detail"));
    const { runner, componentProps } = mount();
    await flush(runner, componentProps);

    await propsOf(runner.output, ProjectBoardTab).onMove([
      { taskId: "task-a", columnId: "done", position: 0 },
    ]);
    runner.render(componentProps);

    expect(propsOf(runner.output, ProjectBoardTab).tasks.map((task) => task.columnId)).toEqual([
      "todo",
      "doing",
    ]);
    const notice = textContent(render(runner.output, 4));
    expect(notice).toContain("We couldn't save that task move. The board has been restored.");
    expect(notice).not.toContain("raw database detail");
  });

  it("completes a list task optimistically and moves it to the done column", async () => {
    const { runner, componentProps } = mount({ tab: "list" });
    await flush(runner, componentProps);

    await propsOf(runner.output, ProjectListTab).onToggleComplete(tasks[0]);
    runner.render(componentProps);

    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "task-a",
      { completed: true, status: "completed" }
    );
    expect(
      propsOf(runner.output, ProjectListTab).tasks.find((task) => task.id === "task-a")
    ).toEqual(expect.objectContaining({ columnId: "done", status: "completed", completed: true }));
    expect(componentProps.onProjectTasksChanged).toHaveBeenCalled();
  });
  it("archives a task from its row and surfaces a failure as a notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { runner, componentProps } = mount({ tab: "list" });
    await flush(runner, componentProps);

    await propsOf(runner.output, ProjectListTab).onArchive(tasks[0]);
    await flush(runner, componentProps);
    expect(projectService.archiveProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "task-a"
    );

    projectService.archiveProjectTask.mockRejectedValueOnce(new Error("Archive blocked."));
    await propsOf(runner.output, ProjectListTab).onArchive(tasks[1]);
    await flush(runner, componentProps);
    expect(textContent(render(runner.output, 4))).toContain("Archive blocked.");
  });
});

describe("ProjectWorkspacePage detail panel", () => {
  const openItem = async (itemId, overrides = {}) => {
    const mounted = mount({ openItemRequest: { projectId: "project-a", itemId, request: 1 }, ...overrides });
    await flush(mounted.runner, mounted.componentProps);
    mounted.runner.render(mounted.componentProps);
    return mounted;
  };

  it("opens the item App asked for", async () => {
    const { runner } = await openItem("task-a");

    expect(propsOf(runner.output, TaskDetailPanel).task.id).toBe("task-a");
    expect(propsOf(runner.output, TaskDetailPanel).readOnly).toBe(false);
  });

  it("returns to the story after opening one of its tasks", async () => {
    const { runner, componentProps } = await openItem("story-a");

    const panel = () => propsOf(runner.output, TaskDetailPanel);
    expect(panel().task.id).toBe("story-a");
    expect(panel().relatedTasks.map((task) => task.id)).toEqual(["task-a"]);
    expect(panel().archiveLinkedTaskCount).toBe(1);

    panel().onOpenRelatedTask(tasks[0]);
    runner.render(componentProps);
    expect(panel().task.id).toBe("task-a");

    panel().onClose();
    runner.render(componentProps);
    expect(panel().task.id).toBe("story-a");
  });

  it("moves linked tasks to No story before archiving a story", async () => {
    const { runner } = await openItem("story-a");
    const panel = propsOf(runner.output, TaskDetailPanel);

    await expect(panel.onArchive()).rejects.toThrow(
      "Move linked tasks to No story before archiving this story."
    );
    expect(projectService.archiveProjectTask).not.toHaveBeenCalled();

    await panel.onArchive({ moveLinkedTasksToUncategorized: true });
    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "task-a",
      { storyId: null }
    );
    expect(projectService.archiveProjectTask).toHaveBeenCalledWith("user-a", "project-a", "story-a");
    expect(projectService.archiveProjectTask.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...projectService.updateProjectTask.mock.invocationCallOrder)
    );
  });

  it("reports bulk story updates with the shared result shape", async () => {
    workspaceLoader.consumeProjectWorkspace.mockResolvedValue({
      tasks: [story, tasks[0], { ...tasks[1], id: "task-c", storyId: "story-a" }],
      columns,
      members,
    });
    projectService.updateProjectTask.mockImplementation((_userId, _projectId, taskId) =>
      taskId === "task-c" ? Promise.reject(new Error("denied")) : Promise.resolve()
    );
    const { runner } = await openItem("story-a");

    const result = await propsOf(runner.output, TaskDetailPanel).onBulkUpdateRelatedTasks(
      ["task-a", "task-c"],
      { type: "priority", value: "high" }
    );

    expect(projectService.updateProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "task-a",
      { priority: "high" }
    );
    expect(result).toEqual({ updated: 1, failed: 1, failedIds: ["task-c"] });
  });

  it("keeps bulk story destinations and assignees inside the project", async () => {
    const { runner } = await openItem("story-a");
    const panel = propsOf(runner.output, TaskDetailPanel);

    await expect(
      panel.onBulkUpdateRelatedTasks(["task-a"], { type: "story", value: "outside-story" })
    ).rejects.toThrow("Choose a story from this project.");
    await expect(
      panel.onBulkUpdateRelatedTasks(["task-a"], { type: "assignee", value: "outsider" })
    ).rejects.toThrow("Choose a member of this project.");
  });

  it("deletes a story through the attachment cleanup path", async () => {
    const { runner } = await openItem("story-a");

    await propsOf(runner.output, TaskDetailPanel).onDelete();

    expect(attachmentService.removeAll).toHaveBeenCalledWith({
      projectId: "project-a",
      entityType: "story",
      entityId: "story-a",
    });
    expect(projectService.deleteProjectTask).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "story-a"
    );
  });

  it("saves an assignee change and keeps the resolved name on the task", async () => {
    const { runner, componentProps } = await openItem("task-a");

    await propsOf(runner.output, TaskDetailPanel).onSetAssignee("member-a");
    runner.render(componentProps);

    expect(projectService.setTaskAssignee).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "task-a",
      "member-a"
    );
    expect(propsOf(runner.output, TaskDetailPanel).task).toEqual(
      expect.objectContaining({ assigneeId: "member-a", assigneeName: "Sam Cole" })
    );
  });

  it("hides every mutation from viewers", async () => {
    const viewerProject = { ...project, viewerRole: "viewer" };
    const { runner } = await openItem("task-a", {
      project: viewerProject,
      projects: [viewerProject],
    });

    const panel = propsOf(runner.output, TaskDetailPanel);
    expect(panel.readOnly).toBe(true);
    expect(panel.onUpdate).toBeUndefined();
    expect(panel.onArchive).toBeUndefined();
    expect(panel.onDelete).toBeUndefined();
    expect(panel.onSetAssignee).toBeUndefined();
    expect(propsOf(runner.output, ProjectBoardTab).readOnly).toBe(true);
    expect(propsOf(runner.output, ProjectHeader).canEdit).toBe(false);
  });
});
