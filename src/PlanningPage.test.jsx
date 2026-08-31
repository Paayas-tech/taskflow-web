import { describe, expect, it } from "vitest";
import { normalizePlanningGoals, planningIssueLabels, planningStatusGroup } from "./domain/planningDomain";

describe("PlanningPage domain behavior", () => {
  it("groups existing status values consistently", () => {
    expect(planningStatusGroup({ status: "todo", completed: false })).toBe("todo");
    expect(planningStatusGroup({ status: "in_progress", completed: false })).toBe("in-progress");
    expect(planningStatusGroup({ status: "completed", completed: true })).toBe("done");
  });

  it("identifies actionable issues without flagging completed work", () => {
    const risky = { dueDate: "2026-08-20", priority: "high", projectId: "project-a", assigneeId: null, completed: false };
    expect(planningIssueLabels(risky, "2026-08-31")).toEqual(["Overdue", "High priority", "Unassigned"]);
    expect(planningIssueLabels({ ...risky, completed: true, status: "completed" }, "2026-08-31")).toEqual([]);
  });

  it("keeps only valid persisted goals", () => {
    expect(normalizePlanningGoals([null, { id: "goal-a", title: "Launch" }, { id: "missing-title" }])).toEqual([{ id: "goal-a", title: "Launch" }]);
    expect(normalizePlanningGoals("invalid")).toEqual([]);
  });
});
