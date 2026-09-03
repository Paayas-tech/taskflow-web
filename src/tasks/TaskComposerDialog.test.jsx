import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const projectContext = vi.hoisted(() => ({ calls: [] }));

vi.mock("../projects/useProjectContext", () => ({
  useProjectContext: (userId, projectId) => {
    projectContext.calls.push([userId, projectId]);
    return {
      project: null,
      tasks: [],
      stories: [{ id: "story-1", title: "Billing" }],
      members: [{ userId: "user-a", displayName: "Alex Member", role: "editor" }],
      columns: [],
      loading: false,
      error: "",
      reload: () => {},
    };
  },
  invalidateProjectContext: () => {},
}));
vi.mock("../services/reminderService", () => ({ requestNotificationPermission: vi.fn() }));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskComposerDialog } from "./TaskComposerDialog";

const projects = [{ id: "project-1", name: "Launch" }];

const mount = (overrides = {}) => {
  const runner = runtime.createRunner(TaskComposerDialog);
  runner.render({ open: true, onSubmit: vi.fn(), onClose: vi.fn(), ...overrides });
  return runner;
};

const bodyOf = (runner) => render(props(runner.output).children, 3);
const footerOf = (runner) => render(props(runner.output).footer, 3);

const titleInput = (runner) =>
  find(bodyOf(runner), (node) => node.type === "input" && props(node).className?.includes("composer-title"));

const submitButton = (runner) =>
  findAll(footerOf(runner), (node) => node.type === "button").at(-1);

const controlLabels = (runner) =>
  findAll(bodyOf(runner), (node) => node.type === "select").map(
    (node) => props(node)["aria-label"]
  );

describe("TaskComposerDialog", () => {
  it("titles the dialog and disables Create until a title is typed", () => {
    const runner = mount();

    expect(props(runner.output).title).toBe("New task");
    expect(props(submitButton(runner)).disabled).toBe(true);
    expect(textContent(submitButton(runner))).toContain("Create task");

    props(titleInput(runner)).onChange({ target: { value: "Ship release" } });
    runner.render();

    expect(props(submitButton(runner)).disabled).toBe(false);
  });

  it("seeds itself from initialValues when it opens", () => {
    const runner = runtime.createRunner(TaskComposerDialog);
    runner.render({ open: false, onSubmit: vi.fn(), onClose: vi.fn() });
    runner.render({
      open: true,
      onSubmit: vi.fn(),
      onClose: vi.fn(),
      initialValues: { title: "From quick add", dueDate: "2026-09-02", projectId: "project-1" },
      projects,
    });
    runner.render();

    expect(props(titleInput(runner)).value).toBe("From quick add");
    expect(
      props(find(bodyOf(runner), (node) => props(node)["aria-label"] === "Due date")).value
    ).toBe("2026-09-02");
  });

  it("submits the full value shape and then closes", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: "task-9" });
    const onClose = vi.fn();
    const runner = mount({ onSubmit, onClose, projects });

    props(titleInput(runner)).onChange({ target: { value: "  Ship release  " } });
    runner.render();
    await props(submitButton(runner)).onClick();

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Ship release",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      projectId: "",
      storyId: "",
      assigneeId: "",
      workType: "task",
      reminder: false,
      reminderAt: "",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("carries the calendar schedule fields through and shows a time chip", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const runner = runtime.createRunner(TaskComposerDialog);
    runner.render({ open: false, onSubmit, onClose: vi.fn() });
    runner.render({
      open: true,
      onSubmit,
      onClose: vi.fn(),
      formatSettings: { format: "24-hour" },
      initialValues: {
        title: "Design review",
        dueDate: "2026-09-02",
        endDate: "2026-09-02",
        startTime: "09:00",
        endTime: "10:00",
      },
    });
    runner.render();

    const chip = find(
      bodyOf(runner),
      (node) => props(node).className === "composer-schedule"
    );
    expect(textContent(chip)).toContain("09:00–10:00");

    await props(submitButton(runner)).onClick();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Design review",
        dueDate: "2026-09-02",
        endDate: "2026-09-02",
        startTime: "09:00",
        endTime: "10:00",
      })
    );
  });

  it("submits with Cmd+Enter from anywhere in the body", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const runner = mount({ onSubmit });

    props(titleInput(runner)).onChange({ target: { value: "Ship release" } });
    runner.render();
    await props(props(runner.output).children).onKeyDown({
      key: "Enter",
      metaKey: true,
      preventDefault: vi.fn(),
    });

    expect(onSubmit).toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the error when creation fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network down"));
    const onClose = vi.fn();
    const runner = mount({ onSubmit, onClose });

    props(titleInput(runner)).onChange({ target: { value: "Ship release" } });
    runner.render();
    await props(submitButton(runner)).onClick();
    runner.render();

    expect(onClose).not.toHaveBeenCalled();
    expect(textContent(bodyOf(runner))).toContain("Network down");
  });

  it("loads members and stories once a project is chosen", () => {
    const runner = mount({ userId: "user-1", projects });

    expect(projectContext.calls.at(-1)).toEqual(["user-1", null]);
    expect(controlLabels(runner)).toEqual(["Status", "Priority", "Project"]);

    props(find(bodyOf(runner), (node) => props(node)["aria-label"] === "Project")).onChange({
      target: { value: "project-1" },
    });
    runner.render();

    expect(projectContext.calls.at(-1)).toEqual(["user-1", "project-1"]);
    expect(controlLabels(runner)).toEqual(["Status", "Priority", "Assignee", "Story", "Project"]);
  });

  it("uses the supplied project context instead of loading one", () => {
    const runner = mount({
      userId: "user-1",
      projects,
      lockProject: true,
      initialValues: { projectId: "project-1" },
      projectContext: { members: [], stories: [] },
    });

    expect(projectContext.calls.at(-1)).toEqual(["user-1", null]);
    // No members were supplied, so only the story chip joins the locked project.
    expect(controlLabels(runner)).toEqual(["Status", "Priority", "Story"]);
  });

  it("hides the story, reminder and project chips for a new story", () => {
    const runner = mount({
      workType: "story",
      userId: "user-1",
      projects,
      lockProject: true,
      initialValues: { projectId: "project-1" },
      projectContext: { members: [{ userId: "user-a", displayName: "Alex Member", role: "editor" }], stories: [] },
    });

    expect(props(runner.output).title).toBe("New story");
    expect(props(titleInput(runner))["aria-label"]).toBe("Story title");
    expect(controlLabels(runner)).toEqual(["Status", "Priority", "Assignee"]);
    expect(textContent(bodyOf(runner))).not.toContain("Remind me");
    expect(textContent(submitButton(runner))).toContain("Create story");
  });

  it("clears the story and assignee when the project changes", () => {
    const runner = mount({
      userId: "user-1",
      projects,
      initialValues: { projectId: "project-1", storyId: "story-1", assigneeId: "user-a" },
    });

    props(find(bodyOf(runner), (node) => props(node)["aria-label"] === "Project")).onChange({
      target: { value: "" },
    });
    runner.render();

    expect(controlLabels(runner)).toEqual(["Status", "Priority", "Project"]);
  });
});
