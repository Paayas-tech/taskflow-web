import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  const same = (left, right) =>
    Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])));

  return {
    activate(runner) {
      activeRunner = runner;
    },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { value: typeof initialValue === "function" ? initialValue() : initialValue };
      const slot = activeRunner.slots[index];
      return [slot.value, (next) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useEffect(effect, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (!previous || !same(previous.dependencies, dependencies)) {
        activeRunner.pending.push({ index, effect, dependencies });
      }
    },
  };
});

vi.mock("react", () => ({
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

import ProjectTaskQuickCreate from "./ProjectTaskQuickCreate";

const mountedRunners = new Set();

function childrenOf(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
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

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function createRunner(props) {
  const runner = { cursor: 0, pending: [], slots: [], output: null };
  const api = {
    render(nextProps = props) {
      props = nextProps;
      runner.cursor = 0;
      runner.pending = [];
      hookRuntime.activate(runner);
      runner.output = ProjectTaskQuickCreate(props);
      for (const pending of runner.pending) {
        runner.slots[pending.index]?.cleanup?.();
        runner.slots[pending.index] = {
          dependencies: pending.dependencies,
          cleanup: pending.effect(),
        };
      }
      return runner.output;
    },
    unmount() {
      for (const slot of [...runner.slots].reverse()) slot?.cleanup?.();
      mountedRunners.delete(api);
    },
    get output() {
      return runner.output;
    },
  };
  mountedRunners.add(api);
  api.render();
  return api;
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => {
  globalThis.window = { requestAnimationFrame: (callback) => { callback(); return 1; } };
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe("ProjectTaskQuickCreate", () => {
  it("starts focused, rejects a blank title, and cancels with Escape", async () => {
    const onCreate = vi.fn();
    const onCancel = vi.fn();
    const runner = createRunner({ contextLabel: "To do", onCreate, onCancel });
    let input = findElement(runner.output, (node) => node.type === "input");

    expect(input.props.autoFocus).toBe(true);
    input.props.onKeyDown({ key: "Escape", preventDefault: vi.fn() });
    expect(onCancel).toHaveBeenCalledOnce();

    await findElement(runner.output, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    runner.render();
    input = findElement(runner.output, (node) => node.type === "input");
    expect(input.props["aria-invalid"]).toBe(true);
    expect(textContent(runner.output)).toContain("Enter a task title.");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("trims and creates one task, then stays ready for rapid entry", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const runner = createRunner({ contextLabel: "To do", onCreate, onCancel: vi.fn() });
    findElement(runner.output, (node) => node.type === "input").props.onChange({ target: { value: "  Review release  " } });
    runner.render();

    await findElement(runner.output, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith("Review release");
    expect(findElement(runner.output, (node) => node.type === "input").props.value).toBe("");
  });

  it("preserves the title and shows a sanitized retry message after failure", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("raw provider detail"));
    const runner = createRunner({ contextLabel: "To do", onCreate, onCancel: vi.fn() });
    findElement(runner.output, (node) => node.type === "input").props.onChange({ target: { value: "Prepare demo" } });
    runner.render();

    await findElement(runner.output, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    runner.render();

    expect(findElement(runner.output, (node) => node.type === "input").props.value).toBe("Prepare demo");
    expect(textContent(runner.output)).toContain("We couldn't create this task. Check your connection and try again.");
    expect(textContent(runner.output)).not.toContain("raw provider detail");
  });

  it("blocks duplicate submissions while creation is pending", async () => {
    const pending = deferred();
    const onCreate = vi.fn().mockReturnValue(pending.promise);
    const runner = createRunner({ contextLabel: "To do", onCreate, onCancel: vi.fn() });
    findElement(runner.output, (node) => node.type === "input").props.onChange({ target: { value: "One task" } });
    runner.render();
    const submit = findElement(runner.output, (node) => node.type === "form").props.onSubmit;

    const first = submit({ preventDefault: vi.fn() });
    await submit({ preventDefault: vi.fn() });
    expect(onCreate).toHaveBeenCalledOnce();

    pending.resolve();
    await first;
  });
});
