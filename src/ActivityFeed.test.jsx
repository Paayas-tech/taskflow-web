import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  const same = (left, right) => Boolean(
    left && right && left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
  return {
    activate(runner) { activeRunner = runner; },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [slot.value, (next) => {
        slot.value = typeof next === "function" ? next(slot.value) : next;
      }];
    },
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) return previous.value;
      activeRunner.slots[index] = { dependencies, value: callback };
      return callback;
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

const projectService = vi.hoisted(() => ({
  getProjectActivity: vi.fn(),
  getTaskActivity: vi.fn(),
  subscribeToProjectActivity: vi.fn(),
  subscribeToTaskActivity: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useState: hookRuntime.useState,
}));
vi.mock("./application/projectService", () => projectService);
vi.mock("./ActivityRow", () => ({
  default: ({ activity }) => <div>{activity.displayName}: {activity.eventType}</div>,
}));

import ActivityFeed from "./ActivityFeed";

const mountedRunners = new Set();

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
  return { ...node, props: { ...node.props, children: childrenOf(node).map(resolveNode) } };
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  return findElement(childrenOf(node), predicate);
}

function createRunner(props) {
  const runner = { cursor: 0, pending: [], slots: [], output: null };
  function render() {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = resolveNode(ActivityFeed(props));
    for (const pending of runner.pending) {
      runner.slots[pending.index]?.cleanup?.();
      runner.slots[pending.index] = {
        dependencies: pending.dependencies,
        cleanup: pending.effect(),
      };
    }
    return runner.output;
  }
  function unmount() {
    for (const slot of [...runner.slots].reverse()) slot?.cleanup?.();
    mountedRunners.delete(api);
  }
  const api = { render, unmount, get output() { return runner.output; } };
  mountedRunners.add(api);
  render();
  return api;
}

async function flush(runner) {
  await Promise.resolve();
  await Promise.resolve();
  runner.render();
}

beforeEach(() => {
  projectService.getProjectActivity.mockReset().mockResolvedValue([{
    id: "activity-a",
    eventType: "task_updated",
    displayName: "Taylor",
    createdAt: new Date().toISOString(),
  }]);
  projectService.getTaskActivity.mockReset().mockResolvedValue([]);
  projectService.subscribeToProjectActivity.mockReset();
  projectService.subscribeToTaskActivity.mockReset();
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
});

describe("ActivityFeed realtime fallback", () => {
  it("uses the shared activity timeline heading", async () => {
    projectService.subscribeToProjectActivity.mockReturnValue(vi.fn());
    const runner = createRunner({ userId: "user-a", projectId: "project-a" });
    await flush(runner);

    expect(textContent(runner.output)).toContain("Activity");
    expect(textContent(runner.output)).toContain("Recent changes.");
    expect(textContent(runner.output)).toContain("Refresh");
  });

  it("reloads history and confirms a successful manual refresh", async () => {
    projectService.subscribeToProjectActivity.mockReturnValue(vi.fn());
    const runner = createRunner({ userId: "user-a", projectId: "project-a" });
    await flush(runner);
    const refresh = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node).includes("Refresh")
    );

    await refresh.props.onClick();
    runner.render();

    expect(projectService.getProjectActivity).toHaveBeenCalledTimes(2);
    expect(textContent(runner.output)).toContain("History is up to date.");
  });

  it("keeps fetched activity visible when live updates fail and recovers", async () => {
    let onStatus;
    const cleanup = vi.fn();
    projectService.subscribeToProjectActivity.mockImplementation((_projectId, _onChange, status) => {
      onStatus = status;
      return cleanup;
    });
    const runner = createRunner({ userId: "user-a", projectId: "project-a" });
    await flush(runner);

    expect(textContent(runner.output)).toContain("Taylor: task_updated");
    onStatus("CHANNEL_ERROR");
    runner.render();
    expect(textContent(runner.output)).toContain("Taylor: task_updated");
    expect(textContent(runner.output)).toContain(
      "Live updates are paused. Refresh to check for new activity."
    );

    onStatus("SUBSCRIBED");
    runner.render();
    expect(textContent(runner.output)).not.toContain("Live updates are paused");
    runner.unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("uses the task-filtered subscription for task history", async () => {
    projectService.subscribeToTaskActivity.mockReturnValue(vi.fn());
    const runner = createRunner({
      userId: "user-a",
      projectId: "project-a",
      taskId: "task-a",
    });
    await flush(runner);

    expect(projectService.getTaskActivity).toHaveBeenCalledWith("user-a", "task-a", 20);
    expect(projectService.subscribeToTaskActivity).toHaveBeenCalledWith(
      "task-a",
      expect.any(Function),
      expect.any(Function)
    );
    expect(projectService.subscribeToProjectActivity).not.toHaveBeenCalled();
  });
});
