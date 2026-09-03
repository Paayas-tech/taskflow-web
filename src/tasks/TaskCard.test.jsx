import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const sortable = vi.hoisted(() => ({
  calls: [],
  state: {
    attributes: { role: "button", tabIndex: 0 },
    listeners: { onPointerDown: () => {} },
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  },
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: (options) => {
    sortable.calls.push(options);
    return sortable.state;
  },
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

import { find, props, render, textContent } from "../test/elementTree";
import { TaskCard } from "./TaskCard";

const todayKey = "2026-09-02";

const buildTask = (overrides = {}) => ({
  id: "task-a",
  title: "Prepare release",
  status: "todo",
  priority: "high",
  dueDate: "",
  ...overrides,
});

const renderCard = ({ task: taskOverrides, ...rest } = {}) =>
  TaskCard({ task: buildTask(taskOverrides), todayKey, ...rest });

describe("TaskCard", () => {
  it("makes the whole card the drag handle and opens from click or keyboard", () => {
    const onOpen = vi.fn();
    const card = renderCard({ onOpen });

    expect(sortable.calls.at(-1)).toEqual({ id: "task:task-a", disabled: false });
    expect(props(card).role).toBe("button");
    expect(props(card).tabIndex).toBe(0);
    expect(props(card)["aria-label"]).toBe("Prepare release");
    expect(props(card).onPointerDown).toBeTypeOf("function");

    props(card).onClick({ currentTarget: "card-element" });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "task-a" }), "card-element");

    const preventDefault = vi.fn();
    props(card).onKeyDown({ key: "Enter", preventDefault, currentTarget: "card-element" });
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(find(card, (node) => props(node).className === "task-card-body")).toBeTruthy();
  });

  it("disables sorting for viewers", () => {
    renderCard({ readOnly: true });

    expect(sortable.calls.at(-1)).toEqual({ id: "task:task-a", disabled: true });
  });

  it("shows the story badge, due label and assignee avatar", () => {
    const assigneeId = "414b9bdb-dad5-467e-b361-8d3cb82eeac8";
    const card = render(
      renderCard({
        task: { storyName: "Billing", dueDate: "2026-09-02", assigneeId, assigneeName: "Priya Shah" },
      })
    );

    expect(textContent(card)).toContain("Billing");
    expect(textContent(card)).toContain("Today");
    expect(textContent(card)).not.toContain(assigneeId);
    expect(props(find(card, (node) => String(props(node).className || "").includes("avatar"))).title).toBe(
      "Priya Shah"
    );
  });

  it("omits the due label and the avatar when there is nothing to show", () => {
    const card = render(renderCard());

    expect(find(card, (node) => node.type === "time")).toBeUndefined();
    expect(find(card, (node) => String(props(node).className || "").includes("avatar"))).toBeUndefined();
  });

  it("adds a bulk checkbox that does not start a drag or open the task", () => {
    const onToggleSelect = vi.fn();
    const card = render(renderCard({ selectable: true, selectedForBulk: true, onToggleSelect }));
    const wrapper = find(card, (node) => props(node).className === "task-card-select");
    const input = find(card, (node) => node.type === "input");
    const stopPropagation = vi.fn();

    props(wrapper).onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(props(input)["aria-label"]).toBe("Select Prepare release");

    props(input).onChange({});
    expect(onToggleSelect).toHaveBeenCalledWith("task-a");
  });

  it("opens a linked project from its badge without opening the card", () => {
    const onOpen = vi.fn();
    const onOpenProject = vi.fn();
    const project = { id: "project-1", name: "Launch", color: "#5b5bd6" };
    const card = render(
      renderCard({
        task: { projectId: project.id },
        context: { projectsById: new Map([[project.id, project]]) },
        onOpen,
        onOpenProject,
      })
    );
    const badge = find(card, (node) =>
      String(props(node).className || "").includes("task-badge-project")
    );
    const stopPropagation = vi.fn();

    expect(badge.type).toBe("button");
    expect(props(badge).title).toBe("Open project");
    props(badge).onClick({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: "task-a" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the project badge non-interactive without a project handler", () => {
    const card = render(
      renderCard({ task: { projectId: "project-1", projectName: "Launch" } })
    );
    const badge = find(card, (node) =>
      String(props(node).className || "").includes("task-badge-project")
    );

    expect(badge.type).toBe("span");
  });
});
