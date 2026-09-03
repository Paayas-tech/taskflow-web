import { beforeEach, describe, expect, it, vi } from "vitest";

const projectContext = vi.hoisted(() => ({
  state: {
    project: null,
    tasks: [],
    stories: [],
    members: [],
    columns: [],
    loading: false,
    error: "",
    reload: () => {},
  },
  calls: [],
  invalidated: [],
}));

vi.mock("../projects/useProjectContext", () => ({
  useProjectContext: (userId, projectId) => {
    projectContext.calls.push([userId, projectId]);
    return projectContext.state;
  },
  invalidateProjectContext: (projectId) => projectContext.invalidated.push(projectId),
}));

vi.mock("./TaskDetailPanel", () => ({
  TaskDetailPanel: (panelProps) => ({ type: "task-detail-panel", props: panelProps }),
}));

import { props } from "../test/elementTree";
import { ConnectedTaskDetailPanel } from "./ConnectedTaskDetailPanel";

const projectTask = {
  id: "task-1",
  title: "Review release",
  projectId: "project-1",
  workType: "task",
};

const taskActions = () => ({
  update: vi.fn().mockResolvedValue(undefined),
  toggleComplete: vi.fn().mockResolvedValue(undefined),
  archive: vi.fn().mockResolvedValue(undefined),
  restore: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  setAssignee: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  projectContext.calls = [];
  projectContext.invalidated = [];
  projectContext.state = {
    project: null,
    tasks: [],
    stories: [{ id: "story-1", title: "Billing" }],
    members: [{ userId: "user-a", displayName: "Alex Member", role: "editor" }],
    columns: [{ id: "col-1", name: "To do" }],
    loading: false,
    error: "",
    reload: () => {},
  };
});

describe("ConnectedTaskDetailPanel", () => {
  it("renders nothing without a task but still keeps hook order stable", () => {
    expect(ConnectedTaskDetailPanel({ task: null, userId: "user-1", taskActions: taskActions() })).toBeNull();
    expect(projectContext.calls).toEqual([["user-1", null]]);
  });

  it("passes the loaded project context down to the panel", () => {
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      projects: [{ id: "project-1", name: "Launch", viewerRole: "editor" }],
      taskActions: taskActions(),
      onClose: vi.fn(),
    });

    expect(projectContext.calls).toEqual([["user-1", "project-1"]]);
    expect(props(panel).projectMembers).toHaveLength(1);
    expect(props(panel).projectStories).toHaveLength(1);
    expect(props(panel).projectColumns).toHaveLength(1);
    expect(props(panel).readOnly).toBe(false);
    expect(props(panel).contextLoading).toBe(false);
  });

  it("marks the panel read-only for a viewer", () => {
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      projects: [{ id: "project-1", name: "Launch", viewerRole: "viewer" }],
      taskActions: taskActions(),
    });

    expect(props(panel).readOnly).toBe(true);
  });

  it("falls back to the loaded project record for the viewer role", () => {
    projectContext.state.project = { id: "project-1", viewerRole: "viewer" };
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      taskActions: taskActions(),
    });

    expect(props(panel).readOnly).toBe(true);
  });

  it("binds the task into every task action", async () => {
    const actions = taskActions();
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      taskActions: actions,
    });

    await props(panel).onUpdate({ priority: "high" });
    expect(actions.update).toHaveBeenCalledWith(projectTask, { priority: "high" });

    props(panel).onToggleComplete();
    expect(actions.toggleComplete).toHaveBeenCalledWith(projectTask);

    props(panel).onArchive({ moveLinkedTasksToUncategorized: true });
    expect(actions.archive).toHaveBeenCalledWith(projectTask, {
      moveLinkedTasksToUncategorized: true,
    });

    props(panel).onRestore();
    expect(actions.restore).toHaveBeenCalledWith(projectTask);

    props(panel).onDelete();
    expect(actions.remove).toHaveBeenCalledWith(projectTask);
  });

  it("drops the cached project context after an update or assignment", async () => {
    const actions = taskActions();
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      taskActions: actions,
    });

    await props(panel).onUpdate({ priority: "high" });
    await props(panel).onSetAssignee("user-a");

    expect(actions.setAssignee).toHaveBeenCalledWith(projectTask, "user-a");
    expect(projectContext.invalidated).toEqual(["project-1", "project-1"]);
  });

  it("offers no assignee control for a personal task", () => {
    const panel = ConnectedTaskDetailPanel({
      task: { id: "task-2", title: "Buy milk", projectId: null },
      userId: "user-1",
      taskActions: taskActions(),
    });

    expect(props(panel).onSetAssignee).toBeUndefined();
    expect(projectContext.calls).toEqual([["user-1", null]]);
  });

  it("omits callbacks the task actions object does not provide", () => {
    const panel = ConnectedTaskDetailPanel({
      task: projectTask,
      userId: "user-1",
      taskActions: { update: vi.fn() },
    });

    expect(props(panel).onArchive).toBeUndefined();
    expect(props(panel).onDelete).toBeUndefined();
    expect(props(panel).onToggleComplete).toBeUndefined();
  });
});
