import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useState: (initialValue) => [initialValue, vi.fn()],
}));

import TaskRow from "./TaskRow";

const assigneeId = "11111111-1111-4111-8111-111111111111";

const textContent = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  return textContent(node.props?.children);
};

const renderTask = (overrides = {}) =>
  TaskRow({
    task: {
      id: "task-1",
      title: "Review release",
      description: "",
      notes: "",
      status: "todo",
      priority: "medium",
      completed: false,
      dueDate: "",
      reminder: false,
      reminderAt: null,
      listId: null,
      projectId: null,
      assigneeId,
      assigneeName: "Alex Member",
      ...overrides,
    },
    lists: [],
    projects: [],
    formatSettings: {},
  });

describe("TaskRow assignee identity", () => {
  it("renders the assignee display name without exposing the internal user ID", () => {
    const renderedText = textContent(renderTask());

    expect(renderedText).toContain("Alex Member");
    expect(renderedText).not.toContain(assigneeId);
  });

  it("uses the safe fallback without exposing the internal user ID", () => {
    const renderedText = textContent(renderTask({ assigneeName: "" }));

    expect(renderedText).toContain("TaskFlow user");
    expect(renderedText).not.toContain(assigneeId);
  });

  it("shows a formatted due date and omits the undated placeholder", () => {
    expect(textContent(renderTask({ dueDate: "2099-01-02" }))).toContain("02/01/2099");
    expect(textContent(renderTask())).not.toContain("No due date");
  });
});
