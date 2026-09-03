import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs";
import { findAll, findByText, textContent } from "../test/elementTree";

const items = [
  { id: "comments", label: "Comments", count: 2 },
  { id: "activity", label: "Activity" },
];

describe("Tabs", () => {
  it("renders a tablist with one tab per item", () => {
    const output = Tabs({ items, value: "comments", ariaLabel: "Task details" });

    expect(output.props.role).toBe("tablist");
    expect(output.props["aria-label"]).toBe("Task details");
    expect(findAll(output, (node) => node.props.role === "tab")).toHaveLength(2);
  });

  it("marks the selected tab and shows its count", () => {
    const output = Tabs({ items, value: "comments" });
    const tabs = findAll(output, (node) => node.props.role === "tab");

    expect(tabs[0].props["aria-selected"]).toBe(true);
    expect(tabs[0].props.className).toBe("tab is-active");
    expect(tabs[1].props["aria-selected"]).toBe(false);
    expect(textContent(findByText(output, "2"))).toBe("2");
  });

  it("reports the selected id", () => {
    const onChange = vi.fn();
    const output = Tabs({ items, value: "comments", onChange });

    findAll(output, (node) => node.props.role === "tab")[1].props.onClick();
    expect(onChange).toHaveBeenCalledWith("activity");
  });
});
