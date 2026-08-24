import { describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};

const resolveNode = (node) => {
  if (Array.isArray(node)) return node.map(resolveNode);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return resolveNode(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: childrenOf(node).map(resolveNode) },
  };
};

const textContent = (node) => {
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join(" ");
};

const classNames = (node, names = []) => {
  if (Array.isArray(node)) {
    node.forEach((child) => classNames(child, names));
    return names;
  }
  if (!node || typeof node !== "object") return names;
  if (node.props?.className) names.push(node.props.className);
  childrenOf(node).forEach((child) => classNames(child, names));
  return names;
};

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const renderDashboard = (overrides = {}) =>
  resolveNode(Dashboard({
    tasks: [],
    tasksLoading: false,
    tasksError: "",
    onRetry: vi.fn(),
    myDaySettings: { resetMode: "midnight", customResetTime: "00:00" },
    assignedTasks: [],
    onOpenProject: vi.fn(),
    onOpenInvitations: vi.fn(),
    ...overrides,
  }));

describe("Dashboard compact presentation", () => {
  it("keeps Today and My work while removing the welcome and statistics strip", () => {
    const output = renderDashboard();
    const text = textContent(output);

    expect(text).toContain("Today");
    expect(text).toContain("My work");
    expect(text).not.toContain("Welcome back");
    expect(text).not.toContain("Remaining");
    expect(text).not.toContain("Active reminders");
    expect(classNames(output)).toContain("dashboard-layout");
    expect(classNames(output)).not.toContain("dashboard-summary");
  });

  it("preserves task and reminder content", () => {
    const output = renderDashboard({
      tasks: [
        {
          id: "task-1",
          title: "Prepare release",
          status: "todo",
          completed: false,
          dueDate: todayKey(),
          priority: "high",
          reminder: true,
        },
      ],
    });
    const text = textContent(output);

    expect(text).toContain("Prepare release");
    expect(text).toContain("High priority");
    expect(text).toContain("Reminder");
  });
});
