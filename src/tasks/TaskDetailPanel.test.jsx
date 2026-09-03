import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

vi.mock("../collaboration/TaskComments", () => ({
  default: () => ({ type: "div", props: { children: "comments" } }),
}));
vi.mock("../collaboration/ActivityFeed", () => ({
  default: () => ({ type: "div", props: { children: "activity" } }),
}));
vi.mock("../collaboration/AttachmentSection", () => ({
  default: () => ({ type: "div", props: { children: "attachments" } }),
}));
vi.mock("../services/reminderService", () => ({ requestNotificationPermission: vi.fn() }));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskDetailPanel } from "./TaskDetailPanel";

const task = (overrides = {}) => ({
  id: "task-1",
  title: "Review release",
  description: "Check the changelog",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  reminder: false,
  reminderAt: null,
  projectId: null,
  storyId: null,
  workType: "task",
  archivedAt: null,
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const mount = (overrides = {}) => {
  const runner = runtime.createRunner(TaskDetailPanel);
  runner.render({ task: task(), onClose: vi.fn(), ...overrides });
  return runner;
};

const panelOf = (runner) => runner.output.props.children[0];
const dialogsOf = (runner) => runner.output.props.children.slice(1);

const bodyOf = (runner) => render(panelOf(runner), 2);
const headerOf = (runner) => render(props(panelOf(runner)).header, 3);

const controlFor = (runner, label) =>
  find(
    render(panelOf(runner), 4),
    (node) => (node.type === "select" || node.type === "input") && props(node)["aria-label"] === label
  );

const titleField = (runner) =>
  find(bodyOf(runner), (node) => props(node).className === "panel-title");

const saveStateText = (runner) =>
  textContent(find(bodyOf(runner), (node) => props(node).className === "panel-save-state"));

describe("TaskDetailPanel header", () => {
  it("shows the breadcrumb, complete toggle and close button", () => {
    const onToggleComplete = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onToggleComplete });
    const header = headerOf(runner);

    expect(textContent(find(header, (node) => props(node).className.includes("panel-breadcrumb")))).toBe(
      "My tasks"
    );
    expect(textContent(header)).toContain("Mark complete");
    expect(find(header, (node) => props(node)["aria-label"] === "Close panel")).toBeTruthy();
  });

  it("names the project and story in the breadcrumb", () => {
    const runner = mount({
      task: task({ projectId: "project-1", storyId: "story-1", storyName: "Billing" }),
      project: { id: "project-1", name: "Launch" },
    });

    expect(
      textContent(find(headerOf(runner), (node) => props(node).className.includes("panel-breadcrumb")))
    ).toBe("Launch › Billing");
  });

  it("labels the button Completed once the task is done", () => {
    const runner = mount({
      task: task({ status: "completed", completed: true }),
      onToggleComplete: vi.fn(),
    });

    expect(textContent(headerOf(runner))).toContain("Completed");
  });

  it("hides every mutating action from viewers and keeps close", () => {
    const runner = mount({
      readOnly: true,
      onToggleComplete: vi.fn(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
    });
    const header = headerOf(runner);

    expect(textContent(header)).toContain("View only");
    expect(textContent(header)).not.toContain("Mark complete");
    expect(find(header, (node) => props(node)["aria-label"] === "Archive task")).toBeUndefined();
    expect(find(header, (node) => props(node)["aria-label"] === "Close panel")).toBeTruthy();
  });
});

describe("TaskDetailPanel auto-save", () => {
  it("saves a trimmed title on Enter and reports the save state", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onUpdate });

    props(titleField(runner)).onChange({ target: { value: "  Ship release  " } });
    runner.render();
    const preventDefault = vi.fn();
    props(titleField(runner)).onKeyDown({ key: "Enter", preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith({ title: "Ship release" });
    runner.render();
    expect(saveStateText(runner)).toContain("Saving…");

    await flush();
    runner.render();
    expect(saveStateText(runner)).toContain("Saved");
  });

  it("refuses to save an empty title", () => {
    const onUpdate = vi.fn();
    const runner = mount({ onUpdate });

    props(titleField(runner)).onChange({ target: { value: "   " } });
    runner.render();
    props(titleField(runner)).onBlur();
    runner.render();

    expect(onUpdate).not.toHaveBeenCalled();
    expect(textContent(bodyOf(runner))).toContain("Enter a task title.");
  });

  it("restores the stored title on Escape", () => {
    const onUpdate = vi.fn();
    const runner = mount({ onUpdate });

    props(titleField(runner)).onChange({ target: { value: "Draft" } });
    runner.render();
    props(titleField(runner)).onKeyDown({ key: "Escape", preventDefault: vi.fn() });
    runner.render();

    expect(props(titleField(runner)).value).toBe("Review release");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("saves the description on blur only when it changed", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onUpdate });
    const description = find(bodyOf(runner), (node) => props(node).className === "panel-description");

    props(description).onBlur();
    expect(onUpdate).not.toHaveBeenCalled();

    props(description).onChange({ target: { value: "New notes" } });
    runner.render();
    find(bodyOf(runner), (node) => props(node).className === "panel-description").props.onBlur();

    expect(onUpdate).toHaveBeenCalledWith({ description: "New notes" });
  });

  it("saves a status change immediately with the matching completed flag", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onUpdate });

    props(controlFor(runner, "Status")).onChange({ target: { value: "completed" } });

    expect(onUpdate).toHaveBeenCalledWith({ status: "completed", completed: true });
  });

  it("saves the reminder pair together with an ISO time", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onUpdate, task: task({ dueDate: "2099-01-02" }) });
    const toggle = find(
      render(panelOf(runner), 4),
      (node) => node.type === "input" && props(node).type === "checkbox"
    );

    props(toggle).onChange({ target: { checked: true } });

    const patch = onUpdate.mock.calls[0][0];
    expect(patch.reminder).toBe(true);
    expect(patch.reminderAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("routes the assignee through onSetAssignee and reverts a failure", async () => {
    const onSetAssignee = vi.fn().mockRejectedValue(new Error("Not allowed"));
    const onUpdate = vi.fn();
    const runner = mount({
      onUpdate,
      onSetAssignee,
      task: task({ projectId: "project-1" }),
      projectMembers: [{ userId: "user-a", displayName: "Alex Member", role: "editor" }],
    });

    props(controlFor(runner, "Assignee")).onChange({ target: { value: "user-a" } });
    await flush();
    runner.render();

    expect(onSetAssignee).toHaveBeenCalledWith("user-a");
    expect(onUpdate).not.toHaveBeenCalled();
    expect(saveStateText(runner)).toContain("Not allowed");
    expect(props(controlFor(runner, "Assignee")).value).toBe("");
  });

  it("offers a retry after a failed save", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(new Error("Network down")).mockResolvedValue(undefined);
    const runner = mount({ onUpdate });

    props(controlFor(runner, "Priority")).onChange({ target: { value: "high" } });
    await flush();
    runner.render();

    expect(saveStateText(runner)).toContain("Couldn't save");
    const retry = find(bodyOf(runner), (node) => textContent(node) === "Retry");
    props(retry).onClick();

    expect(onUpdate).toHaveBeenNthCalledWith(2, { priority: "high" });
  });

  it("keeps the field being edited when a fresh task object arrives", () => {
    const runner = mount({ onUpdate: vi.fn() });

    props(titleField(runner)).onChange({ target: { value: "Half-typed title" } });
    runner.render();
    runner.render({ task: task({ description: "Updated elsewhere" }), onClose: vi.fn() });
    runner.render();

    expect(props(titleField(runner)).value).toBe("Half-typed title");
    expect(
      props(find(bodyOf(runner), (node) => props(node).className === "panel-description")).value
    ).toBe("Updated elsewhere");
  });
});

describe("TaskDetailPanel lifecycle", () => {
  it("archives directly and closes", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const runner = mount({ onArchive, onClose });

    props(find(headerOf(runner), (node) => props(node)["aria-label"] === "Archive task")).onClick();
    await flush();

    expect(onArchive).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalled();
  });

  it("asks a story with linked tasks to move them before archiving", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const runner = mount({
      task: task({ workType: "story", title: "Billing" }),
      onArchive,
      archiveLinkedTaskCount: 3,
    });

    props(find(headerOf(runner), (node) => props(node)["aria-label"] === "Archive task")).onClick();
    runner.render();

    const confirm = dialogsOf(runner).find((dialog) => props(dialog).open);
    expect(props(confirm).title).toBe("Move linked tasks before archiving?");
    expect(props(confirm).description).toContain("3 linked tasks");
    expect(onArchive).not.toHaveBeenCalled();

    await props(confirm).onConfirm();
    expect(onArchive).toHaveBeenCalledWith({ moveLinkedTasksToUncategorized: true });
  });

  it("confirms a delete before calling onDelete", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const runner = mount({ onDelete, onClose });

    props(find(headerOf(runner), (node) => props(node)["aria-label"] === "Delete task")).onClick();
    runner.render();

    const confirm = dialogsOf(runner).find((dialog) => props(dialog).open);
    expect(props(confirm).danger).toBe(true);
    expect(props(confirm).title).toBe("Delete this task?");

    await props(confirm).onConfirm();
    expect(onDelete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the panel open and explains a failed delete", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    const runner = mount({ onDelete, onClose });

    props(find(headerOf(runner), (node) => props(node)["aria-label"] === "Delete task")).onClick();
    runner.render();
    await props(dialogsOf(runner).find((dialog) => props(dialog).open)).onConfirm();
    runner.render();

    expect(onClose).not.toHaveBeenCalled();
    expect(textContent(render(dialogsOf(runner)[0], 3))).toContain("We couldn't delete this task.");
  });
});

describe("TaskDetailPanel story and collaboration sections", () => {
  const storyTask = task({ id: "story-1", title: "Billing", workType: "story", projectId: "project-1" });
  const relatedTasks = [
    { id: "task-a", title: "Draft plan", status: "todo", priority: "medium", archivedAt: null },
    { id: "task-b", title: "Ship it", status: "completed", completed: true, priority: "low", archivedAt: null },
  ];

  it("shows progress, linked rows and the inline add for a story", () => {
    const runner = mount({
      task: storyTask,
      relatedTasks,
      onOpenRelatedTask: vi.fn(),
      onCreateRelatedTask: vi.fn(),
      userId: "user-a",
    });
    const body = render(panelOf(runner), 3);

    expect(textContent(find(body, (node) => props(node).role === "progressbar"))).toBe("");
    expect(props(find(body, (node) => props(node).role === "progressbar"))["aria-valuenow"]).toBe(50);
    expect(textContent(body)).toContain("1/2 done");
    expect(findAll(body, (node) => props(node).className?.includes?.("task-row"))).not.toHaveLength(0);
    expect(find(body, (node) => props(node).className === "quick-add-trigger")).toBeTruthy();
  });

  it("bulk updates the selected linked tasks and keeps the failures selected", async () => {
    const onBulkUpdateRelatedTasks = vi
      .fn()
      .mockResolvedValue({ updated: 1, failed: 1, failedIds: ["task-b"] });
    const runner = mount({
      task: storyTask,
      relatedTasks,
      onBulkUpdateRelatedTasks,
      userId: "user-a",
      projectMembers: [],
    });

    const selectAll = find(
      render(panelOf(runner), 4),
      (node) => node.type === "input" && props(node).type === "checkbox"
    );
    props(selectAll).onChange();
    runner.render();

    const bar = find(render(panelOf(runner), 1), (node) => props(node).selectedCount === 2);
    expect(bar).toBeTruthy();
    await props(bar).onAction("status", "todo");
    runner.render();

    expect(onBulkUpdateRelatedTasks).toHaveBeenCalledWith(["task-a", "task-b"], {
      type: "status",
      value: "todo",
    });
    expect(textContent(render(panelOf(runner), 3))).toContain("1 of 2 tasks updated");
  });

  it("gives project tasks comment, activity and attachment tabs", () => {
    const runner = mount({ task: task({ projectId: "project-1" }), userId: "user-a" });
    const tabs = find(render(panelOf(runner), 1), (node) => Array.isArray(props(node).items));

    expect(props(tabs).items.map((item) => item.label)).toEqual([
      "Comments",
      "Activity",
      "Attachments",
    ]);
    expect(textContent(render(panelOf(runner), 4))).toContain("comments");
  });

  it("shows no collaboration tabs for a personal task", () => {
    const runner = mount({ userId: "user-a" });

    expect(find(render(panelOf(runner), 1), (node) => Array.isArray(props(node).items))).toBeUndefined();
  });
});
