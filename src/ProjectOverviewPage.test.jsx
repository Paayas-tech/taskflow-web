import { describe, expect, it, vi } from "vitest";
import { ProjectOverviewContent } from "./ProjectOverviewPage";

const children = (node) => (Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(Boolean);
const text = (node) => Array.isArray(node) ? node.map(text).join("")
  : typeof node === "string" || typeof node === "number" ? String(node) : children(node).map(text).join("");
const walk = (node, visitor) => {
  if (Array.isArray(node)) return node.forEach((item) => walk(item, visitor));
  if (!node || typeof node !== "object") return;
  visitor(node); children(node).forEach((item) => walk(item, visitor));
};

const data = {
  project: { name: "Launch", description: "Ship TaskFlow", healthStatus: "on_track", viewerRole: "editor" },
  metrics: { total: 8, completed: 3, inProgress: 2, overdue: 1 },
  statusDistribution: { todo: 3, in_progress: 2, done: 3 },
  overdueTasks: [{ id: "late", title: "Fix launch blocker", status: "todo", dueDate: "2026-08-20", assigneeName: "Asha", assigneeAvatarUrl: "" }],
  recentlyCompletedTasks: [{ id: "done", title: "Publish docs", status: "done", completedAt: "2026-08-21", assigneeName: "Sam", assigneeAvatarUrl: "" }],
};

describe("ProjectOverviewContent", () => {
  it("renders health, metrics, distribution, and both actionable task lists", () => {
    const onOpenTask = vi.fn();
    const tree = ProjectOverviewContent({ data, onHealthChange: vi.fn(), onOpenTask, onBack: vi.fn() });
    expect(text(tree)).toContain("Launch");
    expect(text(tree)).toContain("8Total");
    expect(text(tree)).toContain("Fix launch blocker");
    expect(text(tree)).toContain("Publish docs");
    let taskButton;
    walk(tree, (node) => { if (node.type === "button" && text(node).includes("Fix launch blocker")) taskButton = node; });
    taskButton.props.onClick();
    expect(onOpenTask).toHaveBeenCalledWith("late");
  });

  it("shows viewer health as read-only", () => {
    const tree = ProjectOverviewContent({ data: { ...data, project: { ...data.project, viewerRole: "viewer" } }, onOpenTask: vi.fn(), onBack: vi.fn() });
    let select;
    walk(tree, (node) => { if (node.type === "select") select = node; });
    expect(select).toBeUndefined();
    expect(text(tree)).toContain("On track");
  });

  it("keeps the overview usable while the health migration is pending", () => {
    const tree = ProjectOverviewContent({ data: { ...data, project: { ...data.project, healthSupported: false } }, onOpenTask: vi.fn(), onBack: vi.fn() });
    let select;
    walk(tree, (node) => { if (node.type === "select") select = node; });
    expect(select).toBeUndefined();
    expect(text(tree)).toContain("migration 017");
    expect(text(tree)).toContain("Fix launch blocker");
  });
});
