import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findByText, props, render, textContent } from "../test/elementTree";
import { QuickAdd, QuickAddTrigger } from "./QuickAdd";

const focus = vi.fn();

const inputOf = (tree) => find(render(tree), (node) => node.type === "input");
const errorOf = (tree) =>
  find(render(tree), (node) => String(props(node).className || "").includes("quick-add-error"));

const mountQuickAdd = (propsOverrides = {}) => {
  const runner = runtime.createRunner(QuickAdd);
  const output = runner.render({ onCreate: vi.fn(), ...propsOverrides });
  // The ref callback never runs without a DOM, so stub the focus target.
  focus.mockClear();
  const input = inputOf(output);
  props(input).ref.current = { focus };
  return runner;
};

describe("QuickAdd", () => {
  it("labels the field with its context and starts focused", () => {
    const runner = mountQuickAdd({ contextLabel: "In progress" });
    const tree = render(runner.output);

    expect(props(runner.output)["aria-label"]).toBe("Add task to In progress");
    expect(props(inputOf(runner.output))["aria-label"]).toBe("Task name for In progress");
    expect(props(inputOf(runner.output)).autoFocus).toBe(true);
    expect(textContent(tree)).toContain("Add");
  });

  it("rejects a blank title without calling onCreate", async () => {
    const onCreate = vi.fn();
    const runner = mountQuickAdd({ onCreate });

    await props(runner.output).onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(onCreate).not.toHaveBeenCalled();
    expect(textContent(errorOf(runner.output))).toBe("Enter a task title.");
    expect(focus).toHaveBeenCalled();
  });

  it("trims the title, clears the field and stays open for the next task", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const runner = mountQuickAdd({ onCreate });

    props(inputOf(runner.output)).onChange({ target: { value: "  Ship release  " } });
    runner.render();
    await props(runner.output).onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(onCreate).toHaveBeenCalledWith("Ship release");
    expect(props(inputOf(runner.output)).value).toBe("");
    expect(errorOf(runner.output)).toBeUndefined();
  });

  it("keeps the typed title and shows a retry message after a failure", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Network down"));
    const runner = mountQuickAdd({ onCreate });

    props(inputOf(runner.output)).onChange({ target: { value: "Ship release" } });
    runner.render();
    await props(runner.output).onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(props(inputOf(runner.output)).value).toBe("Ship release");
    expect(textContent(errorOf(runner.output))).toBe("Network down");
  });

  it("cancels on Escape and hands the title to the composer on Shift+Enter", () => {
    const onCancel = vi.fn();
    const onOpenDetails = vi.fn();
    const runner = mountQuickAdd({ onCancel, onOpenDetails });

    props(inputOf(runner.output)).onChange({ target: { value: "Draft plan" } });
    runner.render();

    props(inputOf(runner.output)).onKeyDown({ key: "Escape", preventDefault: vi.fn() });
    expect(onCancel).toHaveBeenCalled();

    props(inputOf(runner.output)).onKeyDown({
      key: "Enter",
      shiftKey: true,
      preventDefault: vi.fn(),
    });
    expect(onOpenDetails).toHaveBeenCalledWith("Draft plan");
  });
});

describe("QuickAddTrigger", () => {
  it("renders a labelled ghost row", () => {
    const onClick = vi.fn();
    const tree = QuickAddTrigger({ onClick });

    expect(props(tree).className).toContain("quick-add-trigger");
    expect(textContent(tree)).toContain("Add task");

    props(tree).onClick();
    expect(onClick).toHaveBeenCalled();
  });

  it("accepts a custom label", () => {
    expect(textContent(findByText(QuickAddTrigger({ label: "Add story" }), "Add story"))).toBe(
      "Add story"
    );
  });
});
