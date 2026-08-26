import { describe, expect, it, vi } from "vitest";
import ProjectRemindersPanel from "./ProjectRemindersPanel";

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
    ProjectRemindersPanel({
      reminder: {
        defaultTime: 30,
        enableInAppReminders: true,
        enableSound: false,
      },
      onBack: vi.fn(),
      onDefaultTimeChange: vi.fn(),
      onInAppRemindersChange: vi.fn(),
      onSoundChange: vi.fn(),
      ...overrides,
    })
  );
}

describe("ProjectRemindersPanel", () => {
  it("preserves the detail heading, description, and back action", () => {
    const onBack = vi.fn();
    const output = renderPanel({ onBack });
    const section = findElement(output, (node) => node.type === "section");
    const backButton = findElement(output, (node) => node.type === "button");

    expect(section.props["aria-labelledby"]).toBe("settings-detail-title");
    expect(textContent(findElement(output, (node) => node.type === "h2"))).toBe(
      "Project Reminders"
    );
    expect(textContent(output)).toContain(
      "TaskFlow currently supports a shared reminder default, not project-specific policies."
    );
    expect(backButton.props["aria-label"]).toBe("Back from Project Reminders");
    expect(textContent(backButton)).toBe("←");
    backButton.props.onClick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("preserves the numeric reminder field and emits a numeric draft value", () => {
    const onDefaultTimeChange = vi.fn();
    const output = renderPanel({ onDefaultTimeChange });
    const input = findElement(output, (node) => node.props?.type === "number");

    expect(textContent(output)).toContain("Default reminder (minutes before)");
    expect(input.props).toMatchObject({ min: "1", max: "1440", value: 30 });
    input.props.onChange({ target: { value: "45" } });
    expect(onDefaultTimeChange).toHaveBeenCalledWith(45);
  });

  it("preserves both immediate toggle values, copy, and callbacks", () => {
    const onInAppRemindersChange = vi.fn();
    const onSoundChange = vi.fn();
    const output = renderPanel({ onInAppRemindersChange, onSoundChange });
    const toggles = findElements(output, (node) => node.props?.type === "checkbox");

    expect(textContent(output)).toContain(
      "In-app remindersShow TaskFlow reminders while the app is open."
    );
    expect(textContent(output)).toContain(
      "Reminder soundPlay a subtle sound for delivered reminders."
    );
    expect(toggles.map((toggle) => toggle.props.checked)).toEqual([true, false]);

    toggles[0].props.onChange({ target: { checked: false } });
    toggles[1].props.onChange({ target: { checked: true } });
    expect(onInAppRemindersChange).toHaveBeenCalledWith(false);
    expect(onSoundChange).toHaveBeenCalledWith(true);
  });
});
