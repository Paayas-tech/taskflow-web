import { describe, expect, it } from "vitest";
import StoryOverviewPanel from "./StoryOverviewPanel";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter((child) => child !== null && child !== undefined && child !== false);
};
const walk = (node, visit) => {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
};
const text = (node) => typeof node === "string" || typeof node === "number"
  ? String(node)
  : childrenOf(node).map(text).join("");
const find = (root, predicate) => {
  let match;
  walk(root, (node) => { if (!match && predicate(node)) match = node; });
  return match;
};

describe("StoryOverviewPanel", () => {
  it("calculates progress, custom-column status counts, and assignee workload", () => {
    const tree = StoryOverviewPanel({
      tasks: [
        { id: "a", columnId: "backlog", status: "todo", assigneeId: "member-a", assigneeName: "Alice" },
        { id: "b", columnId: "doing", status: "in-progress", assigneeId: "member-a", assigneeName: "Alice" },
        { id: "c", columnId: "done", status: "completed", completed: true },
      ],
      columns: [
        { id: "backlog", name: "Backlog" },
        { id: "doing", name: "Building" },
        { id: "done", name: "Released" },
      ],
      members: [],
    });

    expect(text(tree)).toContain("33% complete");
    expect(text(tree)).toContain("3Total tasks1Completed2Remaining");
    expect(text(tree)).toContain("Backlog1Building1Released1");
    expect(text(tree)).toContain("Alice2");
    expect(text(tree)).toContain("Unassigned1");
    const progress = find(tree, (node) => node.props?.role === "progressbar");
    expect(progress.props["aria-valuenow"]).toBe(33);
    expect(childrenOf(progress)[0].props.style.width).toBe("33%");
  });

  it("shows an empty zero-percent overview without assignee rows", () => {
    const tree = StoryOverviewPanel({ tasks: [] });
    expect(text(tree)).toContain("0% complete");
    expect(text(tree)).toContain("To do0In progress0Done0");
    expect(find(tree, (node) => node.props?.["aria-label"] === "Tasks by assignee")).toBeUndefined();
  });
});
