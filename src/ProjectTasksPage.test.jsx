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
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.value;
      }
      activeRunner.slots[index] = { dependencies, value: callback };
      return callback;
    },
    useMemo(factory, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && same(previous.dependencies, dependencies)) {
        return previous.value;
      }
      const value = factory();
      activeRunner.slots[index] = { dependencies, value };
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

const projectService = vi.hoisted(() => ({
  archiveProjectTask: vi.fn(),
  createProjectTask: vi.fn(),
  deleteProjectTask: vi.fn(),
  getProjectColumns: vi.fn(),
  getProjectMembers: vi.fn(),
  getProjectTasks: vi.fn(),
  reorderProjectTasks: vi.fn(),
  setTaskAssignee: vi.fn(),
  updateProjectTask: vi.fn(),
}));

const childCalls = vi.hoisted(() => ({ boards: [], rows: [], forms: [] }));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));
vi.mock("./application/projectService", () => projectService);
vi.mock("./ProjectBoard", () => ({
  default: (props) => {
    childCalls.boards.push(props);
    return <div data-testid="project-board">{props.tasks.map((task) => task.title).join("|")}</div>;
  },
}));
vi.mock("./TaskRow", () => ({
  default: (props) => {
    childCalls.rows.push(props);
    return <div data-testid="task-row">{props.task.title}</div>;
  },
}));
vi.mock("./ActivityFeed", () => ({ default: () => null }));
vi.mock("./CalendarPage", () => ({ default: () => null }));
vi.mock("./ProjectMembersModal", () => ({ default: () => null }));
vi.mock("./TaskEditModal", () => ({ default: () => null }));
vi.mock("./TaskForm", () => ({
  default: (props) => {
    childCalls.forms.push(props);
    return <form data-testid="task-form" onSubmit={props.onSubmit} />;
  },
}));

import ProjectTasksPage from "./ProjectTasksPage";

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

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function createRunner(props) {
  const runner = { cursor: 0, pending: [], slots: [], output: null };

  function render(nextProps = props) {
    props = nextProps;
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.activate(runner);
    runner.output = resolveNode(ProjectTasksPage(props));

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
    runner.slots = [];
    mountedRunners.delete(api);
  }

  const api = {
    render,
    unmount,
    get output() {
      return runner.output;
    },
  };
  mountedRunners.add(api);
  render();
  return api;
}

const columns = [
  { id: "todo", name: "To do", category: "todo" },
  { id: "doing", name: "Doing", category: "in_progress" },
  { id: "done", name: "Done", category: "done" },
];
const tasks = [
  {
    id: "task-a",
    title: "Plan launch",
    columnId: "todo",
    position: 0,
    status: "todo",
    completed: false,
    createdAt: "2026-08-22T09:00:00.000Z",
  },
  {
    id: "task-b",
    title: "Ship launch",
    columnId: "doing",
    position: 0,
    status: "in-progress",
    completed: false,
    createdAt: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "task-archived",
    title: "Archived task",
    columnId: "done",
    position: 0,
    status: "completed",
    completed: true,
    archivedAt: "2026-08-22T11:00:00.000Z",
  },
];

function baseProps(overrides = {}) {
  const project = {
    id: "project-a",
    name: "Launch",
    description: "Coordinate release work",
    viewerRole: "owner",
  };
  return {
    userId: "user-a",
    projectId: "project-a",
    project,
    projects: [project],
    projectsLoading: false,
    projectsError: "",
    onRetryProjects: vi.fn(),
    lists: [],
    onBack: vi.fn(),
    browserNotificationsEnabled: false,
    formatSettings: {},
    weekStartsOn: 0,
    refreshToken: 0,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushWorkspace(runner, props) {
  await Promise.resolve();
  await Promise.resolve();
  runner.render(props);
}

function latestBoard() {
  return childCalls.boards.at(-1);
}

function latestForm() {
  return childCalls.forms.at(-1);
}

beforeEach(() => {
  globalThis.document = {
    activeElement: null,
    body: { style: { overflow: "" } },
  };
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: (callback) => { callback(); return 1; },
  };
  childCalls.boards.length = 0;
  childCalls.rows.length = 0;
  childCalls.forms.length = 0;
  projectService.getProjectTasks.mockReset().mockResolvedValue(tasks);
  projectService.getProjectColumns.mockReset().mockResolvedValue(columns);
  projectService.getProjectMembers.mockReset().mockResolvedValue([
    { userId: "user-a", role: "owner" },
  ]);
  projectService.reorderProjectTasks.mockReset().mockResolvedValue(undefined);
  projectService.archiveProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.createProjectTask.mockReset().mockResolvedValue({ id: "created-task" });
  projectService.deleteProjectTask.mockReset().mockResolvedValue(undefined);
  projectService.setTaskAssignee.mockReset().mockResolvedValue(undefined);
  projectService.updateProjectTask.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe("ProjectTasksPage workspace coordination", () => {
  it("loads the workspace and passes active tasks and columns to the board", async () => {
    const props = baseProps();
    const runner = createRunner(props);
    await flushWorkspace(runner, props);

    expect(projectService.getProjectTasks).toHaveBeenCalledWith("user-a", "project-a");
    expect(projectService.getProjectColumns).toHaveBeenCalledWith("user-a", "project-a");
    expect(projectService.getProjectMembers).toHaveBeenCalledWith("user-a", "project-a");
    expect(textContent(runner.output)).toContain("Launch");
    expect(
      findElement(runner.output, (node) => node.props?.["aria-label"] === "Project task summary")
    ).toBeUndefined();
    expect(latestBoard().columns).toEqual(columns);
    expect(latestBoard().tasks.map((task) => task.id)).toEqual(["task-a", "task-b"]);
    expect(latestBoard().readOnly).toBe(false);
  });

  it.each(["owner", "editor"])("keeps the board editable for %s access", async (role) => {
    const props = baseProps({
      project: { ...baseProps().project, viewerRole: role },
    });
    const runner = createRunner(props);
    await flushWorkspace(runner, props);

    expect(latestBoard().readOnly).toBe(false);
    expect(
      findElement(
        runner.output,
        (node) => node.type === "button" && textContent(node) === "+ New project task"
      )
    ).toBeDefined();
  });

  it("assigns a project task to the selected authorized member during creation", async () => {
    const memberId = "member-a";
    projectService.getProjectMembers.mockResolvedValue([
      { userId: "user-a", displayName: "Owner", role: "owner" },
      { userId: memberId, displayName: "Priya Shah", role: "editor" },
    ]);
    const props = baseProps();
    const runner = createRunner(props);
    await flushWorkspace(runner, props);

    findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "+ New project task"
    ).props.onClick();
    runner.render(props);

    expect(latestForm().projectMembers).toEqual([
      { userId: "user-a", displayName: "Owner", role: "owner" },
      { userId: memberId, displayName: "Priya Shah", role: "editor" },
    ]);
    latestForm().onChange({
      target: { name: "title", value: "Prepare release", type: "text" },
    });
    latestForm().onChange({
      target: { name: "assigneeId", value: memberId, type: "select-one" },
    });
    runner.render(props);

    await latestForm().onSubmit({ preventDefault: vi.fn() });

    const createPayload = projectService.createProjectTask.mock.calls[0][2];
    expect(createPayload).not.toHaveProperty("assigneeId");
    expect(projectService.setTaskAssignee).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      "created-task",
      memberId
    );
  });

  it("keeps viewer access read-only and hides task creation controls", async () => {
    const props = baseProps({
      project: { ...baseProps().project, viewerRole: "viewer" },
    });
    const runner = createRunner(props);
    await flushWorkspace(runner, props);

    expect(latestBoard().readOnly).toBe(true);
    expect(textContent(runner.output)).toContain("Your access: viewer · Read only");
    expect(
      findElement(
        runner.output,
        (node) => node.type === "button" && textContent(node) === "+ New project task"
      )
    ).toBeUndefined();
  });

  it("shows a sanitized workspace failure and retries all workspace reads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    projectService.getProjectTasks
      .mockRejectedValueOnce(new Error("sensitive provider failure"))
      .mockResolvedValueOnce(tasks);
    const props = baseProps();
    const runner = createRunner(props);
    await flushWorkspace(runner, props);

    const alert = findElement(runner.output, (node) => node.props?.role === "alert");
    expect(textContent(alert)).toContain(
      "We couldn't load this project workspace. Check your connection and try again."
    );
    expect(textContent(alert)).not.toContain("sensitive provider failure");
    expect(childCalls.boards).toHaveLength(0);

    const retry = findElement(
      alert,
      (node) => node.type === "button" && textContent(node) === "Try again"
    );
    retry.props.onClick();
    await flushWorkspace(runner, props);

    expect(projectService.getProjectTasks).toHaveBeenCalledTimes(2);
    expect(projectService.getProjectColumns).toHaveBeenCalledTimes(2);
    expect(projectService.getProjectMembers).toHaveBeenCalledTimes(2);
    expect(latestBoard().tasks.map((task) => task.id)).toEqual(["task-a", "task-b"]);
  });

  it("optimistically maps complete placements to column status and completion", async () => {
    const props = baseProps();
    const runner = createRunner(props);
    await flushWorkspace(runner, props);
    const placements = [
      { taskId: "task-a", columnId: "done", position: 0 },
      { taskId: "task-b", columnId: "todo", position: 0 },
    ];

    await latestBoard().onMoveTasks(placements);
    runner.render(props);

    expect(projectService.reorderProjectTasks).toHaveBeenCalledWith(
      "user-a",
      "project-a",
      placements
    );
    expect(latestBoard().tasks).toEqual([
      expect.objectContaining({
        id: "task-a",
        columnId: "done",
        position: 0,
        status: "completed",
        completed: true,
      }),
      expect.objectContaining({
        id: "task-b",
        columnId: "todo",
        position: 0,
        status: "todo",
        completed: false,
      }),
    ]);
  });

  it("restores tasks and shows a sanitized error when board persistence fails", async () => {
    const providerError = new Error("raw database detail");
    vi.spyOn(console, "error").mockImplementation(() => {});
    projectService.reorderProjectTasks.mockRejectedValue(providerError);
    const props = baseProps();
    const runner = createRunner(props);
    await flushWorkspace(runner, props);
    const placements = [
      { taskId: "task-a", columnId: "done", position: 0 },
      { taskId: "task-b", columnId: "todo", position: 0 },
    ];

    await latestBoard().onMoveTasks(placements);
    runner.render(props);

    expect(latestBoard().tasks).toEqual(tasks.slice(0, 2));
    const alert = findElement(runner.output, (node) => node.props?.role === "alert");
    expect(textContent(alert)).toBe(
      "We couldn't save that task move. The board has been restored.Dismiss"
    );
    expect(textContent(alert)).not.toContain(providerError.message);
  });

  it("reloads the same project when the refresh token changes", async () => {
    const initialProps = baseProps();
    const runner = createRunner(initialProps);
    await flushWorkspace(runner, initialProps);

    const refreshedProps = { ...initialProps, refreshToken: 1 };
    runner.render(refreshedProps);
    await flushWorkspace(runner, refreshedProps);

    expect(projectService.getProjectTasks).toHaveBeenCalledTimes(2);
    expect(projectService.getProjectColumns).toHaveBeenCalledTimes(2);
    expect(projectService.getProjectMembers).toHaveBeenCalledTimes(2);
    expect(projectService.getProjectTasks).toHaveBeenNthCalledWith(
      2,
      "user-a",
      "project-a"
    );
  });

  it("keeps the loaded workspace visible during a background refresh failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const initialProps = baseProps();
    const runner = createRunner(initialProps);
    await flushWorkspace(runner, initialProps);

    const refreshTasks = deferred();
    const refreshColumns = deferred();
    const refreshMembers = deferred();
    projectService.getProjectTasks.mockReturnValueOnce(refreshTasks.promise);
    projectService.getProjectColumns.mockReturnValueOnce(refreshColumns.promise);
    projectService.getProjectMembers.mockReturnValueOnce(refreshMembers.promise);

    const refreshedProps = { ...initialProps, refreshToken: 1 };
    runner.render(refreshedProps);
    expect(textContent(runner.output)).toContain("Launch");
    expect(textContent(runner.output)).not.toContain("Loading project tasks...");

    refreshTasks.reject(new Error("temporary provider failure"));
    refreshColumns.resolve(columns);
    refreshMembers.resolve([]);
    await flushWorkspace(runner, refreshedProps);

    expect(textContent(runner.output)).toContain("Launch");
    expect(textContent(runner.output)).toContain(
      "We couldn't load this project workspace. Check your connection and try again."
    );
    expect(textContent(runner.output)).not.toContain("temporary provider failure");
  });

  it("ignores stale responses after changing projects", async () => {
    const firstTasks = deferred();
    const firstColumns = deferred();
    const firstMembers = deferred();
    projectService.getProjectTasks
      .mockReturnValueOnce(firstTasks.promise)
      .mockResolvedValueOnce([{ ...tasks[1], id: "task-new", title: "New workspace" }]);
    projectService.getProjectColumns
      .mockReturnValueOnce(firstColumns.promise)
      .mockResolvedValueOnce(columns);
    projectService.getProjectMembers
      .mockReturnValueOnce(firstMembers.promise)
      .mockResolvedValueOnce([]);

    const initialProps = baseProps();
    const runner = createRunner(initialProps);
    const nextProject = {
      ...initialProps.project,
      id: "project-b",
      name: "Next project",
    };
    const nextProps = baseProps({
      projectId: "project-b",
      project: nextProject,
      projects: [nextProject],
    });
    runner.render(nextProps);
    await flushWorkspace(runner, nextProps);

    expect(projectService.getProjectTasks).toHaveBeenNthCalledWith(
      2,
      "user-a",
      "project-b"
    );
    expect(latestBoard().tasks.map((task) => task.id)).toEqual(["task-new"]);

    firstTasks.resolve([{ ...tasks[0], id: "task-stale", title: "Stale workspace" }]);
    firstColumns.resolve(columns);
    firstMembers.resolve([]);
    await flushWorkspace(runner, nextProps);

    expect(latestBoard().tasks.map((task) => task.id)).toEqual(["task-new"]);
  });
});
