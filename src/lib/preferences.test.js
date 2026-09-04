import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readMyTasksGroup,
  readMyTasksView,
  readProfilePromptDismissed,
  readProjectTab,
  readSidebarCollapsed,
  writeMyTasksGroup,
  writeMyTasksView,
  writeProfilePromptDismissed,
  writeProjectTab,
  writeSidebarCollapsed,
} from "./preferences";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("project tab preference", () => {
  it("remembers the tab a project was last left on", () => {
    writeProjectTab("project-1", "board");
    expect(readProjectTab("project-1")).toBe("board");
    expect(readProjectTab("project-2")).toBe("overview");
  });

  it("ignores an unknown tab and a missing project", () => {
    writeProjectTab("project-1", "timeline");
    writeProjectTab("", "board");
    expect(readProjectTab("project-1")).toBe("overview");
    expect(readProjectTab("")).toBe("overview");
  });
});

describe("view preferences", () => {
  it("round-trips the sidebar, My Tasks view and grouping", () => {
    expect(readSidebarCollapsed()).toBe(false);
    expect(readMyTasksView()).toBe("list");
    expect(readMyTasksGroup()).toBe("due");

    writeSidebarCollapsed(true);
    writeMyTasksView("board");
    writeMyTasksGroup("priority");

    expect(readSidebarCollapsed()).toBe(true);
    expect(readMyTasksView()).toBe("board");
    expect(readMyTasksGroup()).toBe("priority");
  });

  it("falls back to the default for an unsupported value", () => {
    writeMyTasksView("timeline");
    writeMyTasksGroup("colour");
    expect(readMyTasksView()).toBe("list");
    expect(readMyTasksGroup()).toBe("due");
  });
});

describe("profile prompt dismissal", () => {
  it("is remembered per account for the session", () => {
    expect(readProfilePromptDismissed("user-1")).toBe(false);
    writeProfilePromptDismissed("user-1");
    expect(readProfilePromptDismissed("user-1")).toBe(true);
    expect(readProfilePromptDismissed("user-2")).toBe(false);
    expect(readProfilePromptDismissed("")).toBe(false);
  });
});

describe("blocked storage", () => {
  it("keeps reading and writing safe when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeSidebarCollapsed(true)).not.toThrow();
    expect(readSidebarCollapsed()).toBe(false);
    expect(readProjectTab("project-1")).toBe("overview");
  });
});
