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
    expect(text).toContain("My Tasks");
    expect(text).toContain("Upcoming");
    expect(text).toContain("Assigned to me");
    expect(text).toContain("No tasks assigned to you");
    expect(text).toContain("Completed");
    expect(text).toContain("Projects");
    expect(text).not.toContain("Task Overview");
    expect(text).not.toContain("Assigned by me");
    expect(text).not.toContain("People");
    expect(text).not.toContain("Priority");
    expect(text).not.toContain("Focus");
    expect(text).not.toContain("+ New Task");
    expect(text).toContain("Open My Tasks");
    expect(text).not.toContain("Welcome back");
    expect(classNames(output)).not.toContain("dashboard-stat-grid");
    expect(classNames(output)).not.toContain("dashboard-reference-grid");
    expect(classNames(output).some((value) => value.includes("dashboard-assigned-to-me-card"))).toBe(true);
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
    expect(text).toContain("Today");
    expect(text).toContain("high");
    findElement(output, (node) => node.type === "button" && textContent(node).includes("Prepare release")).props.onClick();
    expect(onOpenTask).toHaveBeenCalledWith(task);
  });

  it("shows only assigned project tasks and opens them through the existing task callback", () => {
    const onOpenTask = vi.fn();
    const assignedTask = { id: "assigned-a", projectId: "project-a", projectName: "Project Alpha", title: "Fix dashboard UI", status: "todo", priority: "high", dueDate: todayKey(), workType: "task" };
    const personalAssignment = { id: "personal-a", projectId: null, title: "Personal reminder", status: "todo", priority: "low", workType: "task" };
    const assignedStory = { id: "story-a", projectId: "project-a", projectName: "Project Alpha", title: "Story container", status: "todo", priority: "medium", workType: "story" };
    const output = renderDashboard({ assignedTasks: [assignedTask, personalAssignment, assignedStory], onOpenTask });

    expect(textContent(output)).toContain("Fix dashboard UI");
    expect(textContent(output)).toContain("Project Alpha");
    expect(textContent(output)).not.toContain("Personal reminder");
    expect(textContent(output)).not.toContain("Story container");
    findElement(output, (node) => node.type === "button" && textContent(node).includes("Fix dashboard UI")).props.onClick();
    expect(onOpenTask).toHaveBeenCalledWith(assignedTask);
  });

  it("shows View all only when more than five assigned tasks exist", () => {
    const onViewAllAssigned = vi.fn();
    const assignedTasks = Array.from({ length: 6 }, (_, index) => ({ id: `assigned-${index}`, projectId: "project-a", projectName: "Launch", title: `Assigned ${index}`, status: "todo", priority: "medium", workType: "task" }));
    const output = renderDashboard({ assignedTasks, onViewAllAssigned });

    expect(textContent(output)).toContain("Assigned 0");
    expect(textContent(output)).not.toContain("Assigned 5");
    findElement(output, (node) => node.type === "button" && textContent(node) === "View all" && node.props.onClick === onViewAllAssigned).props.onClick();
    expect(onViewAllAssigned).toHaveBeenCalled();
  });

  it("keeps assigned-task loading, error, and retry states concise", () => {
    const onRetryAssignedTasks = vi.fn();
    const loading = renderDashboard({ assignedTasksLoading: true });
    expect(textContent(loading)).toContain("Loading assigned tasks…");

    const failed = renderDashboard({ assignedTasksError: "private backend detail", onRetryAssignedTasks });
    expect(textContent(failed)).toContain("Assigned tasks unavailable.");
    expect(textContent(failed)).not.toContain("private backend detail");
    findElement(failed, (node) => node.type === "button" && textContent(node) === "Retry").props.onClick();
    expect(onRetryAssignedTasks).toHaveBeenCalled();
  });

  it("completes a task from the My tasks circle", () => {
    const onToggleTask = vi.fn();
    const task = { id: "task-toggle", title: "Finish review", status: "todo", completed: false, priority: "medium" };
    const output = renderDashboard({ tasks: [task], onToggleTask });
    const toggle = findElement(output, (node) => node.type === "button" && node.props?.["aria-label"] === "Mark Finish review complete");
    toggle.props.onClick();
    expect(onToggleTask).toHaveBeenCalledWith(task);
  });

  it("keeps the selected task and active tab visibly persistent", () => {
    const task = { id: "task-selected", title: "Selected work", status: "todo", completed: false, priority: "medium" };
    const output = renderDashboard({ tasks: [task], selectedTaskId: task.id, taskView: "upcoming" });
    const row = findElement(output, (node) => node.type === "article" && node.props.className?.includes("dashboard-home-task-row"));
    const taskButton = findElement(row, (node) => node.type === "button" && textContent(node).includes("Selected work"));
    const selectedTab = findElement(output, (node) => node.type === "button" && textContent(node).includes("Upcoming"));

    expect(row.props.className).toContain("is-selected");
    expect(taskButton.props["aria-pressed"]).toBe(true);
    expect(selectedTab.props["aria-pressed"]).toBe(true);
  });

  it("renders missing due dates as quiet text rather than a date badge", () => {
    const task = { id: "task-undated", title: "Undated work", status: "todo", completed: false, priority: "low" };
    const output = renderDashboard({ tasks: [task] });
    const dueDate = findElement(output, (node) => node.type === "time" && textContent(node) === "No date");

    expect(dueDate).toBeDefined();
    expect(dueDate.props.className).toBe("");
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

  it("routes task actions to the Tasks page instead of creating globally", () => {
    const onViewAllTasks = vi.fn();
    const output = renderDashboard({ onViewAllTasks });
    expect(findElement(output, (node) => node.type === "button" && textContent(node) === "+ New Task")).toBeUndefined();
    findElement(output, (node) => node.type === "button" && textContent(node) === "Open My Tasks").props.onClick();
    findElement(output, (node) => node.type === "button" && textContent(node) === "View all").props.onClick();
    expect(onViewAllTasks).toHaveBeenCalledTimes(2);
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
    expect(textContent(output)).toContain("Shared · Viewer");

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

  it("does not render duplicate summary and priority controls", () => {
    const onFilterTasks = vi.fn();
    const output = renderDashboard({
      onFilterTasks,
      tasks: [{ id: "task-high", title: "Urgent work", status: "in-progress", priority: "high", completed: false }],
    });

    expect(textContent(output)).not.toContain("Focus");
    expect(textContent(output)).not.toContain("Priority");
    expect(onFilterTasks).not.toHaveBeenCalled();
  });

  it("does not render the removed analytics period selector", () => {
    const onChartPeriodChange = vi.fn();
    const output = renderDashboard({ chartPeriod: "7-days", onChartPeriodChange });
    expect(findElement(output, (node) => node.type === "select" && node.props.value === "7-days")).toBeUndefined();
    expect(onChartPeriodChange).not.toHaveBeenCalled();
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
