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

const findElement = (node, predicate) => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return undefined;
  }
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  return findElement(childrenOf(node), predicate);
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
    displayName: "Paayas Shrivastava",
    taskView: "upcoming",
    onTaskViewChange: vi.fn(),
    onStartQuickCreate: vi.fn(),
    onOpenTask: vi.fn(),
    onToggleTask: vi.fn(),
    projects: [],
    projectsLoading: false,
    projectsError: "",
    onRetryProjects: vi.fn(),
    onCreateProject: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenInvitations: vi.fn(),
    ...overrides,
  }));

describe("Dashboard reference presentation", () => {
  it("shows the personalized header, real-data summary, and dashboard cards", () => {
    const output = renderDashboard();
    const text = textContent(output);

    expect(text).toMatch(/Good (morning|afternoon|evening)\s*,\s+Paayas/);
    expect(text).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/);
    expect(text).toContain("Task Overview");
    expect(text).toContain("My tasks");
    expect(text).toContain("Tasks I’ve assigned");
    expect(text).toContain("People");
    expect(text).toContain("Upcoming Tasks");
    expect(text).toContain("Completed");
    expect(text).toContain("Projects");
    expect(text).toContain("Task by Priority");
    expect(text).toContain("Ready to get started?");
    expect(text).toContain("+ New Task");
    expect(text).not.toContain("Welcome back");
    expect(classNames(output)).not.toContain("dashboard-stat-grid");
    expect(classNames(output)).toContain("dashboard-reference-grid");
    expect(classNames(output)).toContain("dashboard-home-primary-grid");
  });

  it("derives task metrics and opens an upcoming personal task", () => {
    const onOpenTask = vi.fn();
    const task = {
      id: "task-1",
      title: "Prepare release",
      status: "todo",
      completed: false,
      dueDate: todayKey(),
      priority: "high",
      createdAt: new Date().toISOString(),
    };
    const output = renderDashboard({ tasks: [task], onOpenTask });
    const text = textContent(output);

    expect(text).toContain("Prepare release");
    expect(text).toContain("1 Due today");
    expect(text).toContain("High 1");
    findElement(output, (node) => node.type === "button" && textContent(node).includes("Prepare release")).props.onClick();
    expect(onOpenTask).toHaveBeenCalledWith(task);
  });

  it("completes a task from the My tasks circle", () => {
    const onToggleTask = vi.fn();
    const task = { id: "task-toggle", title: "Finish review", status: "todo", completed: false, priority: "medium" };
    const output = renderDashboard({ tasks: [task], onToggleTask });
    const toggle = findElement(output, (node) => node.type === "button" && node.props?.["aria-label"] === "Mark Finish review complete");
    toggle.props.onClick();
    expect(onToggleTask).toHaveBeenCalledWith(task);
  });

  it("keeps a task completed today visible in the upcoming dashboard list", () => {
    const task = { id: "task-done-today", title: "Visible after completion", status: "completed", completed: true, completedAt: new Date().toISOString(), priority: "medium" };
    const output = renderDashboard({ tasks: [task], taskView: "upcoming" });
    expect(textContent(output)).toContain("Visible after completion");
    const toggle = findElement(output, (node) => node.type === "button" && node.props?.["aria-label"] === "Mark Visible after completion complete");
    expect(toggle.props.className).toContain("is-complete");
  });

  it("shows the completion check while the optimistic save is pending", () => {
    const task = { id: "task-saving", title: "Saving completion", status: "completed", completed: true, completedAt: new Date().toISOString(), priority: "medium" };
    const output = renderDashboard({ tasks: [task], quickTaskPendingIds: new Set([task.id]) });
    const toggle = findElement(output, (node) => node.type === "button" && node.props?.["aria-label"] === "Mark Saving completion complete");
    expect(toggle.props.disabled).toBe(true);
    expect(textContent(toggle)).toBe("✓");
  });

  it("uses the existing creation and view-all actions", () => {
    const onCreateTask = vi.fn();
    const onViewAllTasks = vi.fn();
    const output = renderDashboard({ onCreateTask, onViewAllTasks });
    findElement(output, (node) => node.type === "button" && textContent(node) === "+ New Task").props.onClick();
    findElement(output, (node) => node.type === "button" && textContent(node) === "View all").props.onClick();
    expect(onCreateTask).toHaveBeenCalled();
    expect(onViewAllTasks).toHaveBeenCalled();
  });

  it("renders accessible projects and routes project actions through existing callbacks", () => {
    const onOpenProject = vi.fn();
    const onViewAllProjects = vi.fn();
    const output = renderDashboard({
      projects: [
        { id: "owned", name: "Launch plan", viewerRole: "owner", color: "#6657c8" },
        { id: "shared", name: "Website refresh", viewerRole: "viewer", color: "#4f8a68" },
      ],
      onOpenProject,
      onViewAllProjects,
    });

    expect(textContent(output)).toContain("Launch plan");
    expect(textContent(output)).toContain("Website refresh");
    expect(textContent(output)).toContain("Shared · viewer");

    findElement(output, (node) => node.type === "button" && textContent(node).includes("Launch plan")).props.onClick();
    expect(onOpenProject).toHaveBeenCalledWith("owned");
  });

  it("shows a retry action when accessible projects fail to load", () => {
    const onRetryProjects = vi.fn();
    const output = renderDashboard({ projectsError: "private detail", onRetryProjects });

    expect(textContent(output)).toContain("Projects are unavailable.");
    expect(textContent(output)).not.toContain("private detail");
    findElement(output, (node) => node.type === "button" && textContent(node) === "Try again").props.onClick();
    expect(onRetryProjects).toHaveBeenCalled();
  });

  it("routes summary and priority actions through the shared task filters", () => {
    const onFilterTasks = vi.fn();
    const output = renderDashboard({
      onFilterTasks,
      tasks: [{ id: "task-high", title: "Urgent work", status: "in-progress", priority: "high", completed: false }],
    });

    findElement(output, (node) => node.type === "button" && textContent(node).includes("In progress")).props.onClick();
    findElement(output, (node) => node.type === "button" && textContent(node).includes("High 1")).props.onClick();

    expect(onFilterTasks).toHaveBeenNthCalledWith(1, { status: "in-progress" });
    expect(onFilterTasks).toHaveBeenNthCalledWith(2, { priority: "high" });
  });

  it("uses the controlled chart period selector", () => {
    const onChartPeriodChange = vi.fn();
    const output = renderDashboard({ chartPeriod: "7-days", onChartPeriodChange });
    findElement(output, (node) => node.type === "select" && node.props.value === "7-days").props.onChange({ target: { value: "30-days" } });
    expect(onChartPeriodChange).toHaveBeenCalledWith("30-days");
  });

  it("switches the dashboard summary between week and month", () => {
    const onSummaryPeriodChange = vi.fn();
    const output = renderDashboard({ summaryPeriod: "week", onSummaryPeriodChange });
    findElement(output, (node) => node.type === "select" && node.props.value === "week").props.onChange({ target: { value: "month" } });
    expect(onSummaryPeriodChange).toHaveBeenCalledWith("month");
    expect(textContent(output)).toContain("My week");
    expect(textContent(output)).toContain("My month");
  });
});
