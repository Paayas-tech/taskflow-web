import { beforeEach, describe, expect, it, vi } from "vitest";
import { find, findAll, render, textContent } from "../test/elementTree";

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

vi.mock("react", () => ({
  useState: runtime.useState,
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
}));
import Onboarding from "./Onboarding";

const createRunner = (props) => ({
  props,
  slots: [],
  cursor: 0,
  render() {
    this.cursor = 0;
    runtime.activate(this);
    return render(Onboarding(this.props));
  },
});

const buttonByText = (tree, label) =>
  find(tree, (node) => node.type === "button" && textContent(node) === label);
const choices = (tree) =>
  findAll(tree, (node) => node.type === "button" && node.props.role === "radio");
const goToPurposeStep = (runner) => {
  find(runner.render(), (node) => node.type === "form").props.onSubmit({
    preventDefault: vi.fn(),
  });
  return runner.render();
};

describe("first-run onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a readable display name before continuing", () => {
    const runner = createRunner({ displayName: "", onComplete: vi.fn() });
    const form = find(runner.render(), (node) => node.type === "form");
    form.props.onSubmit({ preventDefault: vi.fn() });
    const tree = runner.render();
    expect(textContent(find(tree, (node) => node.props?.role === "alert"))).toBe(
      "Enter the name you want teammates to see."
    );
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

  it("returns to the profile step from the purpose step", () => {
    const runner = createRunner({ displayName: "Ada", onComplete: vi.fn() });
    const tree = goToPurposeStep(runner);

    find(
      tree,
      (node) =>
        node.type === "button" && node.props?.["aria-label"] === "Go back to profile step"
    ).props.onClick();

    expect(
      find(runner.render(), (node) => node.type === "input" && node.props.autoComplete === "name")
    ).toBeDefined();
  });

  it("marks the selected purpose as the checked choice", () => {
    const runner = createRunner({ displayName: "Ada", onComplete: vi.fn() });
    let tree = goToPurposeStep(runner);

    expect(choices(tree)).toHaveLength(3);
    expect(choices(tree)[0].props["aria-checked"]).toBe(true);
    expect(choices(tree)[0].props.className).toContain("is-selected");

    choices(tree)[1].props.onClick();
    tree = runner.render();

    expect(choices(tree)[0].props["aria-checked"]).toBe(false);
    expect(choices(tree)[1].props["aria-checked"]).toBe(true);
    expect(choices(tree)[1].props.className).toContain("is-selected");
  });

  it("finishes with the chosen name and purpose", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const runner = createRunner({ displayName: "Ada", saving: false, onComplete });
    let tree = goToPurposeStep(runner);
    find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.role === "radio" &&
        textContent(node).includes("Personal")
    ).props.onClick();
    tree = runner.render();
    await buttonByText(tree, "Enter TaskFlow").props.onClick();
    expect(onComplete).toHaveBeenCalledWith({ displayName: "Ada", purpose: "personal" });
  });

  it("reports a failure to finish setup", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("Workspace is unavailable."));
    const runner = createRunner({ displayName: "Ada", onComplete });
    let tree = goToPurposeStep(runner);
    await buttonByText(tree, "Enter TaskFlow").props.onClick();
    tree = runner.render();
    expect(textContent(find(tree, (node) => node.props?.role === "alert"))).toBe(
      "Workspace is unavailable."
    );
  });
});
