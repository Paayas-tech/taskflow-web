import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const reminderService = vi.hoisted(() => ({ requestNotificationPermission: vi.fn() }));
vi.mock("../services/reminderService", () => reminderService);

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskProperties } from "./TaskProperties";

const baseValues = {
  title: "Review release",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  reminder: false,
  reminderAt: "",
  projectId: "",
  storyId: "",
  assigneeId: "",
  workType: "task",
};

const members = [{ userId: "user-a", displayName: "Alex Member", role: "editor" }];
const stories = [{ id: "story-1", title: "Billing" }];
const projects = [{ id: "project-1", name: "Launch" }];

const mount = (overrides = {}) => {
  const runner = runtime.createRunner(TaskProperties);
  runner.render({ values: baseValues, onChange: vi.fn(), ...overrides });
  return runner;
};

const controlLabels = (tree) =>
  findAll(render(tree), (node) => node.type === "select" || node.type === "input").map(
    (node) => props(node)["aria-label"]
  );

const controlFor = (tree, label) =>
  find(
    render(tree),
    (node) => (node.type === "select" || node.type === "input") && props(node)["aria-label"] === label
  );

describe("TaskProperties rows", () => {
  it("shows the personal rows and a project picker for a personal task", () => {
    const runner = mount({ isPersonal: true, projects });

    expect(controlLabels(runner.output).filter(Boolean)).toEqual([
      "Status",
      "Priority",
      "Due date",
      "Project",
    ]);
    expect(textContent(render(runner.output))).toContain("Remind me");
  });

  it("shows assignee and story rows for a project task and no reminder", () => {
    const runner = mount({ projectMembers: members, projectStories: stories });

    expect(controlLabels(runner.output)).toEqual([
      "Status",
      "Priority",
      "Due date",
      "Assignee",
      "Story",
    ]);
  });

  it("hides the story row for a story itself", () => {
    const runner = mount({ isStory: true, projectMembers: members, projectStories: stories });

    expect(controlLabels(runner.output)).not.toContain("Story");
  });

  it("labels every row in the panel grid", () => {
    const runner = mount({ isPersonal: true, projects });
    const labels = findAll(render(runner.output), (node) => props(node).className === "prop-label");

    expect(labels.map((label) => textContent(label))).toEqual([
      "Status",
      "Priority",
      "Due date",
      "Project",
      "Reminder",
    ]);
  });

  it("renders chips instead of a grid in composer mode", () => {
    const runner = mount({ mode: "composer", isPersonal: true, projects });
    const tree = render(runner.output);

    expect(props(runner.output).className).toContain("props-chips");
    expect(find(tree, (node) => props(node).className === "prop-label")).toBeUndefined();
    expect(findAll(tree, (node) => String(props(node).className || "").includes("props-chip "))).not
      .toHaveLength(0);
  });
});

describe("TaskProperties changes", () => {
  it("reports status, priority and story changes by name", () => {
    const onChange = vi.fn();
    const runner = mount({ onChange, projectMembers: members, projectStories: stories });

    props(controlFor(runner.output, "Status")).onChange({ target: { value: "in-progress" } });
    props(controlFor(runner.output, "Priority")).onChange({ target: { value: "high" } });
    props(controlFor(runner.output, "Story")).onChange({ target: { value: "story-1" } });

    expect(onChange).toHaveBeenNthCalledWith(1, "status", "in-progress");
    expect(onChange).toHaveBeenNthCalledWith(2, "priority", "high");
    expect(onChange).toHaveBeenNthCalledWith(3, "storyId", "story-1");
  });

  it("clears the due date from the inline clear button", () => {
    const onChange = vi.fn();
    const runner = mount({ onChange, values: { ...baseValues, dueDate: "2026-09-02" } });
    const clear = find(
      render(runner.output),
      (node) => props(node)["aria-label"] === "Clear due date"
    );

    props(clear).onClick();
    expect(onChange).toHaveBeenCalledWith("dueDate", "");
  });

  it("lists members by display name without exposing the user id", () => {
    const runner = mount({ projectMembers: members });
    const assignee = controlFor(runner.output, "Assignee");

    expect(textContent(assignee)).toContain("Alex Member · editor");
    expect(textContent(assignee)).not.toContain("user-a");
  });

  it("keeps an unavailable project selectable so the value is not lost", () => {
    const runner = mount({ isPersonal: true, projects, values: { ...baseValues, projectId: "gone" } });

    expect(textContent(controlFor(runner.output, "Project"))).toContain(
      "Current project (unavailable)"
    );
  });

  it("disables every control when the task is read-only", () => {
    const runner = mount({ disabled: true, isPersonal: true, projects });
    const controls = findAll(
      render(runner.output),
      (node) => node.type === "select" || node.type === "input"
    );

    expect(controls.every((control) => props(control).disabled === true)).toBe(true);
  });
});

describe("TaskProperties reminder", () => {
  const reminderValues = { ...baseValues, dueDate: "2099-01-02" };

  it("enables a reminder with a default time and asks for notification permission", () => {
    const onChange = vi.fn();
    const runner = mount({ isPersonal: true, onChange, values: reminderValues });
    const toggle = find(
      render(runner.output),
      (node) => node.type === "input" && props(node).type === "checkbox"
    );

    props(toggle).onChange({ target: { checked: true } });

    expect(reminderService.requestNotificationPermission).toHaveBeenCalled();
    const patch = onChange.mock.calls[0][0];
    expect(patch.reminder).toBe(true);
    expect(patch.reminderAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("clears the time when the reminder is switched off", () => {
    const onChange = vi.fn();
    const runner = mount({
      isPersonal: true,
      onChange,
      values: { ...reminderValues, reminder: true, reminderAt: "2099-01-02T08:45" },
    });
    const toggle = find(
      render(runner.output),
      (node) => node.type === "input" && props(node).type === "checkbox"
    );

    props(toggle).onChange({ target: { checked: false } });

    expect(onChange).toHaveBeenCalledWith({ reminder: false, reminderAt: "" });
  });

  it("applies a preset relative to the task start", () => {
    const onChange = vi.fn();
    const runner = mount({
      isPersonal: true,
      onChange,
      values: { ...reminderValues, reminder: true, reminderAt: "2099-01-02T09:00" },
    });

    props(controlFor(runner.output, "Reminder timing")).onChange({
      target: { value: "1-hour" },
    });

    expect(onChange).toHaveBeenCalledWith({ reminder: true, reminderAt: "2099-01-02T08:00" });
  });

  it("explains an unusable preset instead of emitting a reminder time", () => {
    const onChange = vi.fn();
    const runner = mount({
      isPersonal: true,
      onChange,
      values: { ...baseValues, reminder: true, reminderAt: "2099-01-02T09:00" },
    });

    props(controlFor(runner.output, "Reminder timing")).onChange({ target: { value: "1-hour" } });
    runner.render();

    expect(onChange).not.toHaveBeenCalled();
    expect(textContent(render(runner.output))).toContain(
      "Choose a future task date and time before using this preset."
    );
  });

  it("surfaces the shared reminder validation error", () => {
    const runner = mount({
      isPersonal: true,
      values: { ...baseValues, reminder: true, reminderAt: "2000-01-01T09:00" },
    });

    expect(textContent(render(runner.output))).toContain("Reminder time must be in the future.");
  });
});
