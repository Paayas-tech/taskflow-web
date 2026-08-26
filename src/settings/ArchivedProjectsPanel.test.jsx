import { describe, expect, it, vi } from "vitest";
import ArchivedProjectsPanel from "./ArchivedProjectsPanel";

const PROJECTS = [
  { id: "first", name: "First project", description: "First description" },
  { id: "second", name: "Second project", description: "" },
];

function childrenOf(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
}

function resolveNode(node) {
  if (Array.isArray(node)) return node.map(resolveNode);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return resolveNode(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: childrenOf(node).map(resolveNode) },
  };
}

function walk(node, visitor) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visitor));
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  childrenOf(node).forEach((child) => walk(child, visitor));
}

function findElement(root, predicate) {
  let match;
  walk(root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function findElements(root, predicate) {
  const matches = [];
  walk(root, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function renderPanel(overrides = {}) {
  return resolveNode(
    ArchivedProjectsPanel({
      projects: PROJECTS,
      pendingProjectId: "",
      onViewProject: vi.fn(),
      onRestoreProject: vi.fn(),
      onBack: vi.fn(),
      ...overrides,
    })
  );
}

function projectRows(output) {
  return findElements(
    output,
    (node) => node.props?.className === "settings-archived-project"
  );
}

function buttons(row) {
  return findElements(row, (node) => node.type === "button");
}

describe("ArchivedProjectsPanel", () => {
  it("preserves detail semantics, copy, classes, order, descriptions, and Back", () => {
    const onBack = vi.fn();
    const output = renderPanel({ onBack });
    const rows = projectRows(output);
    const back = findElement(
      output,
      (node) => node.props?.["aria-label"] === "Back from Archived Projects"
    );

    expect(textContent(findElement(output, (node) => node.type === "h2"))).toBe(
      "Archived Projects"
    );
    expect(textContent(output)).toContain("Projects already marked archived.");
    expect(rows.map((row) => textContent(findElement(row, (node) => node.type === "strong")))).toEqual([
      "First project",
      "Second project",
    ]);
    expect(textContent(rows[0])).toContain("First description");
    expect(findElement(rows[1], (node) => node.type === "small")).toBeUndefined();
    expect(rows[0].props.className).toBe("settings-archived-project");
    expect(rows[0].props.children[1].props.className).toBe(
      "settings-archived-project-actions"
    );
    back.props.onClick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("forwards View and Restore with the correct project and button contract", () => {
    const onViewProject = vi.fn();
    const onRestoreProject = vi.fn();
    const output = renderPanel({ onViewProject, onRestoreProject });
    const [view, restore] = buttons(projectRows(output)[0]);

    expect(view.props).toMatchObject({ className: "ghost-btn compact-btn", type: "button" });
    expect(restore.props).toMatchObject({ className: "ghost-btn compact-btn", type: "button" });
    view.props.onClick();
    restore.props.onClick();
    expect(onViewProject).toHaveBeenCalledWith(PROJECTS[0]);
    expect(onRestoreProject).toHaveBeenCalledWith(PROJECTS[0]);
  });

  it("disables both pending actions and changes only its Restore label", () => {
    const output = renderPanel({ pendingProjectId: "second" });
    const [firstRow, secondRow] = projectRows(output);
    const [firstView, firstRestore] = buttons(firstRow);
    const [secondView, secondRestore] = buttons(secondRow);

    expect([firstView.props.disabled, firstRestore.props.disabled]).toEqual([false, false]);
    expect([secondView.props.disabled, secondRestore.props.disabled]).toEqual([true, true]);
    expect(textContent(firstRestore)).toBe("Restore");
    expect(textContent(secondRestore)).toBe("Restoring...");
  });

  it("preserves the empty state", () => {
    const output = renderPanel({ projects: [] });
    const empty = findElement(
      output,
      (node) => node.props?.className === "settings-placeholder-panel"
    );

    expect(projectRows(output)).toHaveLength(0);
    expect(textContent(empty)).toBe("No archived projects.");
  });
});
