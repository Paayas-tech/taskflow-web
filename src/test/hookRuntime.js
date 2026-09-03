/**
 * A tiny React hook runtime for tests that call components as plain functions.
 *
 * Usage (the awaited `vi.hoisted` keeps the runtime available to `vi.mock`):
 *
 * ```js
 * const runtime = await vi.hoisted(async () => {
 *   const { createHookRuntime } = await import("../test/hookRuntime");
 *   return createHookRuntime();
 * });
 * vi.mock("react", () => runtime.react);
 * ```
 *
 * Then drive a component with `runtime.createRunner(Component)`: `render(props)`
 * returns the element tree, state setters mutate the stored slot, and the next
 * `render()` sees the new value. `unmount()` runs effect cleanups.
 */
export function createHookRuntime() {
  let activeRunner = null;

  const same = (left, right) =>
    Boolean(
      left &&
        right &&
        left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]))
    );

  // Components expanded outside a runner (for example by `render()` from
  // elementTree.js) still need working hooks. They get a scratch runner whose
  // slots are never reused, so every hook returns its initial value and no
  // effect is run.
  const detached = { cursor: 0, pending: [], slots: [] };

  const requireRunner = () => activeRunner ?? detached;

  const useState = (initialValue) => {
    const runner = requireRunner();
    const index = runner.cursor++;
    runner.slots[index] ??= {
      value: typeof initialValue === "function" ? initialValue() : initialValue,
    };
    const slot = runner.slots[index];
    return [
      slot.value,
      (next) => {
        slot.value = typeof next === "function" ? next(slot.value) : next;
      },
    ];
  };

  const useRef = (initialValue) => {
    const runner = requireRunner();
    const index = runner.cursor++;
    runner.slots[index] ??= { current: initialValue };
    return runner.slots[index];
  };

  const useCallback = (callback, dependencies) => {
    const runner = requireRunner();
    const index = runner.cursor++;
    const previous = runner.slots[index];
    if (previous && same(previous.dependencies, dependencies)) {
      return previous.callback;
    }
    runner.slots[index] = { callback, dependencies };
    return callback;
  };

  const useMemo = (factory, dependencies) => {
    const runner = requireRunner();
    const index = runner.cursor++;
    const previous = runner.slots[index];
    if (previous && same(previous.dependencies, dependencies)) {
      return previous.value;
    }
    const value = factory();
    runner.slots[index] = { value, dependencies };
    return value;
  };

  const useEffect = (effect, dependencies) => {
    const runner = requireRunner();
    const index = runner.cursor++;
    const previous = runner.slots[index];
    if (!previous || !same(previous.dependencies, dependencies)) {
      runner.pending.push({ index, effect, dependencies });
    }
  };

  const useId = () => {
    const runner = requireRunner();
    const index = runner.cursor++;
    runner.slots[index] ??= { value: `hook-${index}` };
    return runner.slots[index].value;
  };

  const react = {
    default: {},
    useCallback,
    useEffect,
    useId,
    useLayoutEffect: useEffect,
    useMemo,
    useRef,
    useState,
  };

  const createRunner = (component, initialProps = {}) => {
    const runner = { cursor: 0, pending: [], slots: [], output: null, props: initialProps };

    const render = (props = runner.props) => {
      runner.props = props;
      runner.cursor = 0;
      runner.pending = [];
      activeRunner = runner;
      runner.output = component(props);

      for (const pending of runner.pending) {
        runner.slots[pending.index]?.cleanup?.();
        runner.slots[pending.index] = {
          dependencies: pending.dependencies,
          cleanup: pending.effect(),
        };
      }

      activeRunner = null;
      return runner.output;
    };

    const unmount = () => {
      for (const slot of [...runner.slots].reverse()) slot?.cleanup?.();
      runner.slots = [];
      runner.output = null;
    };

    return {
      render,
      unmount,
      get output() {
        return runner.output;
      },
      get props() {
        return runner.props;
      },
    };
  };

  return {
    react,
    createRunner,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
  };
}

export default createHookRuntime;
