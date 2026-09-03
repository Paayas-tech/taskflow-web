import { describe, expect, it, vi } from "vitest";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import ArchivedProjectsPanel from "./ArchivedProjectsPanel";

const PROJECTS = [
  { id: "first", name: "First project", description: "First description" },
  { id: "second", name: "Second project", description: "" },
];

const renderPanel = (overrides = {}) =>
  render(
    ArchivedProjectsPanel({
      projects: PROJECTS,
      pendingProjectId: "",
      onViewProject: vi.fn(),
      onRestoreProject: vi.fn(),
      ...overrides,
    }),
    8
  );

const projectRows = (output) =>
  findAll(output, (node) => props(node).className === "settings-project-row");

const buttons = (row) => findAll(row, (node) => node.type === "button");

describe("ArchivedProjectsPanel", () => {
  it("labels the panel and lists archived projects in order with their descriptions", () => {
    const output = renderPanel();
    const rows = projectRows(output);

    expect(props(output)["aria-label"]).toBe("Archived projects");
    expect(textContent(output)).toContain("Projects you have archived.");
    expect(
      rows.map((row) => textContent(find(row, (node) => props(node).className === "settings-row-label")))
    ).toEqual(["First project", "Second project"]);
    expect(textContent(rows[0])).toContain("First description");
    expect(
      find(rows[1], (node) => props(node).className === "settings-row-description truncate")
    ).toBeUndefined();
  });

  it("forwards Open and Restore with the whole project", () => {
    const onViewProject = vi.fn();
    const onRestoreProject = vi.fn();
    const output = renderPanel({ onViewProject, onRestoreProject });
    const [open, restore] = buttons(projectRows(output)[0]);

    expect(textContent(open)).toBe("Open");
    expect(textContent(restore)).toBe("Restore");
    props(open).onClick();
    props(restore).onClick();
    expect(onViewProject).toHaveBeenCalledWith(PROJECTS[0]);
    expect(onRestoreProject).toHaveBeenCalledWith(PROJECTS[0]);
  });

  it("marks only the restoring row as busy and disables both of its actions", () => {
    const output = renderPanel({ pendingProjectId: "second" });
    const [firstRow, secondRow] = projectRows(output);
    const [firstOpen, firstRestore] = buttons(firstRow);
    const [secondOpen, secondRestore] = buttons(secondRow);

    expect([props(firstOpen).disabled, props(firstRestore).disabled]).toEqual([false, false]);
    expect([props(secondOpen).disabled, props(secondRestore).disabled]).toEqual([true, true]);
    expect(props(firstRestore)["aria-busy"]).toBeUndefined();
    expect(props(secondRestore)["aria-busy"]).toBe(true);
  });

  it("shows an empty state when nothing is archived", () => {
    const output = renderPanel({ projects: [] });

    expect(projectRows(output)).toHaveLength(0);
    expect(textContent(output)).toContain("No archived projects");
  });
});
