import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  const same = (left, right) =>
    Boolean(
      left &&
        right &&
        left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]))
    );

  return {
    activate(runner) {
      activeRunner = runner;
    },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        },
      ];
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useCallback(callback) {
      activeRunner.cursor++;
      return callback;
    },
    useMemo(factory, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.value;
      }
      const value = factory();
      activeRunner.slots[index] = { value, dependencies };
      return value;
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
  default: {},
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

import { SearchDialog, filterSearchItems } from "./SearchDialog";
import { find, findAll, props, textContent } from "../test/elementTree";

const items = [
  { id: "project:project-a", type: "project", title: "Launch", subtitle: "Release work" },
  { id: "task:task-1", type: "task", title: "Write the brief", subtitle: "Personal task" },
  { id: "story:story-1", type: "story", title: "Onboarding", subtitle: "Launch" },
];

function createRunner(componentProps) {
  const runner = { cursor: 0, pending: [], slots: [], output: null };

  const render = (nextProps = componentProps) => {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = SearchDialog(nextProps);
    for (const pending of runner.pending) {
      runner.slots[pending.index]?.cleanup?.();
      runner.slots[pending.index] = {
        dependencies: pending.dependencies,
        cleanup: pending.effect(),
      };
    }
    return runner.output;
  };

  render();
  return {
    render,
    get output() {
      return runner.output;
    },
  };
}

const input = (tree) => find(tree, (node) => props(node).className === "search-input");
const resultButtons = (tree) =>
  findAll(tree, (node) => props(node).role === "option");

beforeEach(() => {
  globalThis.document = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
});

afterEach(() => {
  delete globalThis.document;
});

describe("filterSearchItems", () => {
  it("returns everything up to the limit for an empty query", () => {
    expect(filterSearchItems(items, "  ")).toHaveLength(3);
    expect(filterSearchItems(items, "", 2)).toHaveLength(2);
  });

  it("matches the title or the subtitle, ignoring case", () => {
    expect(filterSearchItems(items, "launch").map((item) => item.id)).toEqual([
      "project:project-a",
      "story:story-1",
    ]);
    expect(filterSearchItems(items, "BRIEF").map((item) => item.id)).toEqual([
      "task:task-1",
    ]);
    expect(filterSearchItems(items, "nothing")).toEqual([]);
  });
});

describe("SearchDialog", () => {
  it("renders a titleless dialog with every item and the first one active", () => {
    const runner = createRunner({ open: true, items, onClose: vi.fn(), onSelect: vi.fn() });

    expect(props(runner.output).title).toBeUndefined();
    expect(props(runner.output)["aria-label"]).toBe("Search TaskFlow");
    expect(props(runner.output).size).toBe("md");

    const options = resultButtons(runner.output);
    expect(options.map((node) => textContent(node))).toEqual([
      "Launch Release work",
      "Write the brief Personal task",
      "Onboarding Launch",
    ]);
    expect(props(options[0])["aria-selected"]).toBe(true);
    expect(props(options[1])["aria-selected"]).toBe(false);
  });

  it("filters as the query changes", () => {
    const runner = createRunner({ open: true, items, onClose: vi.fn(), onSelect: vi.fn() });

    props(input(runner.output)).onChange({ target: { value: "brief" } });
    runner.render();

    expect(resultButtons(runner.output)).toHaveLength(1);
    expect(textContent(resultButtons(runner.output)[0])).toBe(
      "Write the brief Personal task"
    );
  });

  it("moves the active result with the arrow keys and selects it with Enter", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const runner = createRunner({ open: true, items, onClose, onSelect });

    const preventDefault = vi.fn();
    props(input(runner.output)).onKeyDown({ key: "ArrowDown", preventDefault });
    runner.render();
    expect(props(resultButtons(runner.output)[1])["aria-selected"]).toBe(true);

    props(input(runner.output)).onKeyDown({ key: "ArrowUp", preventDefault });
    runner.render();
    expect(props(resultButtons(runner.output)[0])["aria-selected"]).toBe(true);

    props(input(runner.output)).onKeyDown({ key: "Enter", preventDefault });
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("selects a clicked result", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const runner = createRunner({ open: true, items, onClose, onSelect });

    props(resultButtons(runner.output)[2]).onClick();

    expect(onSelect).toHaveBeenCalledWith(items[2]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prompts when nothing matches", () => {
    const runner = createRunner({ open: true, items: [], onClose: vi.fn(), onSelect: vi.fn() });
    expect(textContent(find(runner.output, (node) => props(node).role === "status"))).toBe(
      "Search projects, tasks and stories"
    );

    const withItems = createRunner({ open: true, items, onClose: vi.fn(), onSelect: vi.fn() });
    props(input(withItems.output)).onChange({ target: { value: "zzz" } });
    withItems.render();

    expect(
      textContent(find(withItems.output, (node) => props(node).role === "status"))
    ).toBe("No matches");
  });
});
