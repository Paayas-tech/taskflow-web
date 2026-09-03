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
  it("makes the whole card the drag handle and opens from the inner button", () => {
    const onOpen = vi.fn();
    const card = renderCard({ onOpen });

    expect(sortable.calls.at(-1)).toEqual({ id: "task:task-a", disabled: false });
    expect(props(card).role).toBe("button");
    expect(props(card).onPointerDown).toBeTypeOf("function");

    const openButton = find(card, (node) => props(node).className === "task-card-open");
    props(openButton).onClick({ currentTarget: "card-element" });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "task-a" }), "card-element");
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
});
