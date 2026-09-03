import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskRow } from "./TaskRow";

const assigneeId = "11111111-1111-4111-8111-111111111111";
const todayKey = "2026-09-02";

const buildTask = (overrides = {}) => ({
  id: "task-1",
  title: "Review release",
  description: "",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: null,
  archivedAt: null,
  ...overrides,
});

const renderRow = ({ task: taskOverrides, ...rest } = {}) =>
  TaskRow({ task: buildTask(taskOverrides), todayKey, ...rest });

const hasClass = (node, className) =>
  String(props(node).className || "").split(" ").includes(className);

describe("TaskRow", () => {
  it("opens from a click and from Enter on the row itself", () => {
    const onOpen = vi.fn();
    const row = renderRow({ onOpen });

    expect(props(row).role).toBe("button");
    expect(props(row).tabIndex).toBe(0);

    props(row).onClick({ currentTarget: "row-element" });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }), "row-element");

    const preventDefault = vi.fn();
    props(row).onKeyDown({ key: "Enter", preventDefault, currentTarget: "row-element" });
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("toggles completion from the checkbox without opening the row", () => {
    const onOpen = vi.fn();
    const onToggleComplete = vi.fn();
    const row = render(renderRow({ onOpen, onToggleComplete }));
    const checkbox = find(row, (node) => props(node).role === "checkbox");
    const stopPropagation = vi.fn();

    expect(props(checkbox)["aria-label"]).toBe("Mark Review release complete");
    expect(props(checkbox)["aria-checked"]).toBe(false);

    props(checkbox).onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(onToggleComplete).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("marks completed rows and disables the checkbox for viewers", () => {
    const completed = renderRow({ task: { status: "completed", completed: true } });
    expect(hasClass(completed, "is-complete")).toBe(true);

    const readOnly = render(renderRow({ readOnly: true, onToggleComplete: vi.fn() }));
    expect(props(find(readOnly, (node) => props(node).role === "checkbox")).disabled).toBe(true);
  });

  it("tones the due label by urgency", () => {
    const overdue = render(renderRow({ task: { dueDate: "2026-08-30" } }));
    const overdueDue = find(overdue, (node) => node.type === "time");
    expect(props(overdueDue).className).toContain("is-overdue");
    expect(textContent(overdueDue)).toContain("Aug");

    const today = render(renderRow({ task: { dueDate: todayKey } }));
    const todayDue = find(today, (node) => node.type === "time");
    expect(props(todayDue).className).toContain("is-today");
    expect(textContent(todayDue)).toContain("Today");
  });

  it("shows project and story badges plus the attachment count", () => {
    const row = render(
      renderRow({
        task: { projectId: "project-1", storyName: "Billing", attachmentCount: 2 },
        context: { projectsById: new Map([["project-1", { id: "project-1", name: "Launch", color: "#5b5bd6" }]]) },
      })
    );

    expect(textContent(row)).toContain("Launch");
    expect(textContent(row)).toContain("Billing");
    expect(props(find(row, (node) => hasClass(node, "task-row-attachments")))["aria-label"]).toBe(
      "2 attachments"
    );
  });

  it("opens a linked project from its badge without opening the row", () => {
    const onOpen = vi.fn();
    const onOpenProject = vi.fn();
    const project = { id: "project-1", name: "Launch", color: "#5b5bd6" };
    const row = render(
      renderRow({
        task: { projectId: project.id },
        context: { projectsById: new Map([[project.id, project]]) },
        onOpen,
        onOpenProject,
      })
    );
    const badge = find(row, (node) => hasClass(node, "task-badge-project"));
    const stopPropagation = vi.fn();

    expect(badge.type).toBe("button");
    expect(props(badge).title).toBe("Open project");
    props(badge).onClick({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the project badge non-interactive without a project handler", () => {
    const row = render(renderRow({ task: { projectId: "project-1", projectName: "Launch" } }));

    expect(find(row, (node) => hasClass(node, "task-badge-project")).type).toBe("span");
  });

  it("hides the project badge when the list is already scoped to one project", () => {
    const row = render(
      renderRow({
        showProject: false,
        task: { projectId: "project-1" },
        context: { projectsById: new Map([["project-1", { id: "project-1", name: "Launch" }]]) },
      })
    );

    expect(textContent(row)).not.toContain("Launch");
  });

  it("renders the assignee display name without exposing the internal user id", () => {
    const withName = render(renderRow({ task: { assigneeId, assigneeName: "Alex Member" } }));
    expect(textContent(withName)).not.toContain(assigneeId);
    expect(props(find(withName, (node) => hasClass(node, "avatar"))).title).toBe("Alex Member");

    const withoutName = render(
      renderRow({
        task: { assigneeId },
        context: { membersById: new Map([[assigneeId, { userId: assigneeId, displayName: "" }]]) },
      })
    );
    expect(props(find(withoutName, (node) => hasClass(node, "avatar"))).title).toBe("TaskFlow user");
  });

  it("replaces the checkbox with badges for archived tasks and Google events", () => {
    const archived = render(renderRow({ task: { archivedAt: "2026-08-01T09:00:00.000Z" } }));
    expect(find(archived, (node) => props(node).role === "checkbox")).toBeUndefined();
    expect(textContent(archived)).toContain("Archived");

    const google = render(renderRow({ task: { source: "google" } }));
    expect(find(google, (node) => props(node).role === "checkbox")).toBeUndefined();
    expect(textContent(google)).toContain("G");
  });

  it("offers only the lifecycle actions the caller supports", () => {
    const onRestore = vi.fn();
    const onDeletePermanently = vi.fn();
    const row = TaskRow({
      task: buildTask({ archivedAt: "2026-08-01T09:00:00.000Z" }),
      todayKey,
      onOpen: vi.fn(),
      onRestore,
      onDeletePermanently,
    });
    const menu = find(row, (node) => Array.isArray(props(node).items));

    expect(props(menu).items.map((item) => item.label)).toEqual([
      "Open",
      "Restore",
      "Delete permanently",
    ]);

    props(menu).items[1].onSelect();
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
  });

  it("hides mutating menu actions from viewers", () => {
    const row = TaskRow({
      task: buildTask(),
      todayKey,
      readOnly: true,
      onOpen: vi.fn(),
      onArchive: vi.fn(),
    });
    const menu = find(row, (node) => Array.isArray(props(node).items));

    expect(props(menu).items.map((item) => item.id)).toEqual(["open"]);
  });

  it("adds a bulk selection checkbox that never opens the row", () => {
    const onToggleSelect = vi.fn();
    const onOpen = vi.fn();
    const row = render(
      renderRow({ selectable: true, selectedForBulk: true, onToggleSelect, onOpen })
    );
    const wrapper = find(row, (node) => hasClass(node, "task-row-select"));
    const input = findAll(row, (node) => node.type === "input")[0];
    const stopPropagation = vi.fn();

    props(wrapper).onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(props(input)["aria-label"]).toBe("Select Review release");
    expect(props(input).checked).toBe(true);

    props(input).onChange({});
    expect(onToggleSelect).toHaveBeenCalledWith("task-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("consumes formatSettings for the due tooltip instead of leaking it to the DOM", () => {
    const row = renderRow({
      task: { dueDate: "2026-09-10" },
      formatSettings: { dateFormat: "MM/DD/YYYY" },
    });

    expect(props(row).formatSettings).toBeUndefined();

    const due = find(render(row), (node) => node.type === "time");
    expect(props(due).title).toBe("09/10/2026");
  });
});
