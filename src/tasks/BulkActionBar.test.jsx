import { describe, expect, it, vi } from "vitest";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import { BulkActionBar } from "./BulkActionBar";

const members = [
  { userId: "user-a", displayName: "Alex Member", role: "editor" },
  { userId: "user-b", displayName: "", role: "viewer" },
];

const stories = [
  { id: "story-1", title: "Billing" },
  { id: "story-2", title: "Onboarding" },
];

const selectFor = (tree, label) =>
  find(render(tree), (node) => node.type === "select" && props(node)["aria-label"] === label);

describe("BulkActionBar", () => {
  it("stays hidden until something is selected", () => {
    expect(BulkActionBar({ selectedCount: 0 })).toBeNull();
  });

  it("announces the selection and offers the four bulk edits", () => {
    const tree = render(BulkActionBar({ selectedCount: 3, members, stories }));

    expect(textContent(tree)).toContain("3 selected");
    expect(props(tree).role).toBe("toolbar");
    expect(
      findAll(tree, (node) => node.type === "select").map((node) => props(node)["aria-label"])
    ).toEqual([
      "Change selected task status",
      "Change selected task priority",
      "Change selected task assignee",
      "Move selected tasks to story",
    ]);
  });

  it("maps the unassigned and no-story options to null", () => {
    const onAction = vi.fn();
    const tree = BulkActionBar({ selectedCount: 1, members, stories, onAction });

    props(selectFor(tree, "Change selected task status")).onChange({ target: { value: "todo" } });
    expect(onAction).toHaveBeenCalledWith("status", "todo");

    props(selectFor(tree, "Change selected task assignee")).onChange({
      target: { value: "unassigned" },
    });
    expect(onAction).toHaveBeenCalledWith("assignee", null);

    props(selectFor(tree, "Move selected tasks to story")).onChange({
      target: { value: "uncategorized" },
    });
    expect(onAction).toHaveBeenCalledWith("story", null);
  });

  it("ignores the placeholder option and every action while busy", () => {
    const onAction = vi.fn();
    const idle = BulkActionBar({ selectedCount: 1, onAction });
    props(selectFor(idle, "Change selected task status")).onChange({ target: { value: "" } });
    expect(onAction).not.toHaveBeenCalled();

    const busy = BulkActionBar({ selectedCount: 1, onAction, busy: true });
    props(selectFor(busy, "Change selected task status")).onChange({ target: { value: "todo" } });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("lists members by display name and never offers the current story", () => {
    const tree = BulkActionBar({ selectedCount: 1, members, stories, currentStoryId: "story-1" });
    const assignee = textContent(selectFor(tree, "Change selected task assignee"));
    const story = textContent(selectFor(tree, "Move selected tasks to story"));

    expect(assignee).toContain("Alex Member");
    expect(assignee).toContain("TaskFlow user");
    expect(assignee).not.toContain("user-a");
    expect(story).not.toContain("Billing");
    expect(story).toContain("Onboarding");
  });

  it("clears the selection", () => {
    const onClear = vi.fn();
    const tree = render(BulkActionBar({ selectedCount: 2, onClear }));
    const button = find(tree, (node) => node.type === "button");

    expect(textContent(button)).toBe("Clear");
    props(button).onClick();
    expect(onClear).toHaveBeenCalled();
  });
});
