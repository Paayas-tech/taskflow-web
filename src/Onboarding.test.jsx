import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  let active;
  return {
    activate(runner) { active = runner; },
    useState(initial) {
      const index = active.cursor++;
      active.slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      const slot = active.slots[index];
      return [slot.value, (next) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
  };
});

vi.mock("react", () => ({ useState: runtime.useState }));
import Onboarding from "./Onboarding";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(Boolean);
};
const walk = (node, visit) => {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
};
const text = (node) => typeof node === "string" ? node : childrenOf(node).map(text).join("");
const find = (root, predicate) => {
  let match;
  walk(root, (node) => { if (!match && predicate(node)) match = node; });
  return match;
};
const createRunner = (props) => ({
  props,
  slots: [],
  cursor: 0,
  render() {
    this.cursor = 0;
    runtime.activate(this);
    return Onboarding(this.props);
  },
});

describe("first-run onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a readable display name before continuing", () => {
    const runner = createRunner({ displayName: "", onComplete: vi.fn() });
    const form = find(runner.render(), (node) => node.type === "form");
    form.props.onSubmit({ preventDefault: vi.fn() });
    expect(text(runner.render())).toContain("Enter the name you want teammates to see.");
  });

  it("lets the user leave the first step and restart signup", () => {
    const onStartOver = vi.fn();
    const runner = createRunner({
      displayName: "Ada",
      onComplete: vi.fn(),
      onStartOver,
    });

    find(
      runner.render(),
      (node) =>
        node.type === "button" &&
        node.props?.["aria-label"] === "Go back and start signup over"
    ).props.onClick();

    expect(onStartOver).toHaveBeenCalledOnce();
  });

  it("finishes with the chosen name and purpose", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const runner = createRunner({ displayName: "Ada", saving: false, onComplete });
    find(runner.render(), (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    let tree = runner.render();
    find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.role === "radio" &&
        text(node).includes("Personal")
    ).props.onClick();
    tree = runner.render();
    await find(tree, (node) => node.type === "button" && text(node) === "Enter TaskFlow").props.onClick();
    expect(onComplete).toHaveBeenCalledWith({ displayName: "Ada", purpose: "personal" });
  });
});
