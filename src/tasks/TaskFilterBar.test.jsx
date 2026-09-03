import { describe, expect, it, vi } from "vitest";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskFilterBar } from "./TaskFilterBar";

const priorityFilter = (overrides = {}) => ({
  id: "priority",
  label: "Priority",
  value: "any",
  options: [
    { value: "any", label: "Any" },
    { value: "high", label: "High" },
  ],
  onChange: vi.fn(),
  ...overrides,
});

const selectsOf = (tree) => findAll(render(tree), (node) => node.type === "select");

describe("TaskFilterBar", () => {
  it("labels the search field and reports what was typed", () => {
    const onSearch = vi.fn();
    const tree = render(TaskFilterBar({ search: "rel", onSearch }));
    const input = find(tree, (node) => node.type === "input");

    expect(props(input)["aria-label"]).toBe("Search tasks");
    expect(props(input).value).toBe("rel");

    props(input).onChange({ target: { value: "release" } });
    expect(onSearch).toHaveBeenCalledWith("release");
  });

  it("renders each filter as a labelled chip and reports the chosen value", () => {
    const filter = priorityFilter();
    const tree = TaskFilterBar({ filters: [filter] });
    const chip = find(render(tree), (node) =>
      String(props(node).className || "").includes("filter-select")
    );

    expect(textContent(chip)).toContain("Priority:");

    const select = selectsOf(tree)[0];
    expect(props(select)["aria-label"]).toBe("Priority");
    props(select).onChange({ target: { value: "high" } });
    expect(filter.onChange).toHaveBeenCalledWith("high");
  });

  it("highlights a chip only when it moved off its default", () => {
    const atDefault = find(
      render(TaskFilterBar({ filters: [priorityFilter()] })),
      (node) => String(props(node).className || "").includes("filter-select")
    );
    const changed = find(
      render(TaskFilterBar({ filters: [priorityFilter({ value: "high" })] })),
      (node) => String(props(node).className || "").includes("filter-select")
    );

    expect(props(atDefault).className).not.toContain("is-active");
    expect(props(changed).className).toContain("is-active");
  });

  it("supports checkbox chips such as show completed", () => {
    const filter = {
      id: "completed",
      type: "checkbox",
      label: "Show completed",
      value: false,
      onChange: vi.fn(),
    };
    const tree = render(TaskFilterBar({ filters: [filter] }));
    const input = find(tree, (node) => node.type === "input" && props(node).type === "checkbox");

    expect(textContent(tree)).toContain("Show completed");
    props(input).onChange({ target: { checked: true } });
    expect(filter.onChange).toHaveBeenCalledWith(true);
  });

  it("adds group and sort selects when the page provides them", () => {
    const group = { value: "due", options: [{ value: "due", label: "Due date" }], onChange: vi.fn() };
    const sort = { value: "due", options: [{ value: "due", label: "Due" }], onChange: vi.fn() };
    const labels = selectsOf(TaskFilterBar({ group, sort })).map(
      (select) => props(select)["aria-label"]
    );

    expect(labels).toEqual(["Group by", "Sort"]);
  });

  it("shows Clear only while filters are active", () => {
    const onClear = vi.fn();
    const withoutClear = render(TaskFilterBar({ activeCount: 0, onClear }));
    expect(textContent(withoutClear)).not.toContain("Clear");

    const withClear = render(TaskFilterBar({ activeCount: 2, onClear }));
    const button = find(withClear, (node) => node.type === "button");
    expect(textContent(button)).toBe("Clear");

    props(button).onClick();
    expect(onClear).toHaveBeenCalled();
  });
});
