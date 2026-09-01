import { describe, expect, it, vi } from "vitest";
import BackgroundSettingsPanel from "./BackgroundSettingsPanel";

const BACKGROUNDS = [
  { id: "calm", name: "Calm", category: "Minimal", description: "Soft neutral layers" },
  { id: "ocean", name: "Ocean", category: "Nature", description: "Deep BLUE currents" },
  { id: "focus", name: "Focus", category: "Studio", description: "Quiet workspace" },
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
    BackgroundSettingsPanel({
      backgrounds: BACKGROUNDS,
      selectedBackgroundId: "ocean",
      searchValue: "",
      onSearchChange: vi.fn(),
      onSelectBackground: vi.fn(),
      onBack: vi.fn(),
      ...overrides,
    })
  );
}

function backgroundButtons(output) {
  return findElements(
    output,
    (node) =>
      node.type === "button" &&
      String(node.props?.className || "").includes("settings-background-option")
  );
}

describe("BackgroundSettingsPanel", () => {
  it("preserves detail copy, search semantics, header action, and back behavior", () => {
    const onBack = vi.fn();
    const output = renderPanel({ searchValue: "ocean", onBack });
    const search = findElement(output, (node) => node.props?.type === "search");
    const back = findElement(
      output,
      (node) => node.props?.["aria-label"] === "Back from Choose Background"
    );

    expect(textContent(findElement(output, (node) => node.type === "h2"))).toBe(
      "Choose Background"
    );
    expect(textContent(output)).toContain(
      "Choose a workspace background."
    );
    expect(textContent(output)).toContain("⌕");
    expect(textContent(output)).toContain("Search backgrounds");
    expect(search.props).toMatchObject({ value: "ocean", placeholder: "Search backgrounds" });
    back.props.onClick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("forwards search changes and filters by name, category, or description without reordering", () => {
    const onSearchChange = vi.fn();
    const searchOutput = renderPanel({ onSearchChange });
    findElement(searchOutput, (node) => node.props?.type === "search").props.onChange({
      target: { value: "nature" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("nature");

    expect(backgroundButtons(renderPanel({ searchValue: "  OCEAN " })).map(textContent)).toEqual([
      "OceanNature · Deep BLUE currents✓",
    ]);
    expect(backgroundButtons(renderPanel({ searchValue: "nature" })).map(textContent)).toEqual([
      "OceanNature · Deep BLUE currents✓",
    ]);
    expect(backgroundButtons(renderPanel({ searchValue: "blue" })).map(textContent)).toEqual([
      "OceanNature · Deep BLUE currents✓",
    ]);
    expect(backgroundButtons(renderPanel()).map(textContent)).toEqual([
      "CalmMinimal · Soft neutral layers",
      "OceanNature · Deep BLUE currents✓",
      "FocusStudio · Quiet workspace",
    ]);
  });

  it("preserves selected classes and forwards the selected background", () => {
    const onSelectBackground = vi.fn();
    const output = renderPanel({ onSelectBackground });
    const buttons = backgroundButtons(output);

    expect(buttons[0].props.className).toBe(
      "settings-background-option background-calm "
    );
    expect(buttons[1].props.className).toBe(
      "settings-background-option background-ocean is-selected"
    );
    buttons[0].props.onClick();
    expect(onSelectBackground).toHaveBeenCalledWith(BACKGROUNDS[0]);
  });

  it("preserves the empty search result status", () => {
    const output = renderPanel({ searchValue: "missing" });
    const status = findElement(output, (node) => node.props?.role === "status");

    expect(backgroundButtons(output)).toHaveLength(0);
    expect(status.props.className).toBe("settings-background-empty");
    expect(textContent(status)).toBe("No matches.");
  });
});
