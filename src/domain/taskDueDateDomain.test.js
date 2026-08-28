import { describe, expect, it } from "vitest";
import { taskDueDateMeta } from "./taskDueDateDomain";

describe("task due-date presentation", () => {
  const today = new Date(2026, 7, 28);

  it("hides missing dates", () => {
    expect(taskDueDateMeta("", { today })).toBeNull();
  });

  it("formats upcoming, today, and overdue dates with existing settings", () => {
    expect(taskDueDateMeta("2026-08-29", { today, dateFormat: "DD/MM/YYYY" }))
      .toEqual({ label: "29/08/2026", tone: "upcoming" });
    expect(taskDueDateMeta("2026-08-28", { today, dateFormat: "DD/MM/YYYY" }))
      .toEqual({ label: "Due today", tone: "today" });
    expect(taskDueDateMeta("2026-08-27", { today, dateFormat: "DD/MM/YYYY" }))
      .toEqual({ label: "Overdue · 27/08/2026", tone: "overdue" });
  });
});
