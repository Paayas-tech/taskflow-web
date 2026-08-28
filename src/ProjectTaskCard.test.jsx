import { describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

import ProjectTaskCard from "./ProjectTaskCard";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};

const textContent = (node) => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return childrenOf(node).map(textContent).join("");
};

const find = (node, predicate) => {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of childrenOf(node)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return undefined;
};

describe("ProjectTaskCard assignee presentation", () => {
  it("makes the assigned member prominent without exposing the internal ID", () => {
    const userId = "414b9bdb-dad5-467e-b361-8d3cb82eeac8";
    const output = ProjectTaskCard({
      task: {
        id: "task-a",
        title: "Prepare release",
        priority: "high",
        assigneeId: userId,
        assigneeName: "Priya Shah",
      },
      onEdit: vi.fn(),
    });
    const assignee = find(
      output,
      (node) => String(node.props?.className || "").startsWith("project-task-assignee")
    );

    expect(textContent(assignee)).toContain("PSPriya Shah");
    expect(textContent(output)).not.toContain(userId);
    expect(assignee.props.title).toBe("Assigned to Priya Shah");
  });

  it("shows a formatted due date and omits it when the task has none", () => {
    const dated = ProjectTaskCard({
      task: {
        id: "task-a",
        title: "Prepare release",
        priority: "medium",
        dueDate: "2099-01-02",
      },
      onEdit: vi.fn(),
      formatSettings: { dateFormat: "DD/MM/YYYY" },
    });
    const undated = ProjectTaskCard({
      task: { id: "task-b", title: "Review release", priority: "medium" },
      onEdit: vi.fn(),
    });

    const dueDate = find(dated, (node) => node.type === "time");
    expect(textContent(dueDate)).toBe("02/01/2099");
    expect(dueDate.props.dateTime).toBe("2099-01-02");
    expect(find(undated, (node) => node.type === "time")).toBeUndefined();
  });

  it("labels unassigned work explicitly", () => {
    const output = ProjectTaskCard({
      task: { id: "task-a", title: "Prepare release", priority: "medium" },
      onEdit: vi.fn(),
    });
    const assignee = find(
      output,
      (node) => String(node.props?.className || "").includes("project-task-assignee")
    );

    expect(textContent(assignee)).toContain("Unassigned");
    expect(assignee.props.title).toBe("No assignee");
  });
});
