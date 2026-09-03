import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

vi.mock("../tasks", async () => {
  const presentation = await import("../tasks/taskPresentation");
  return {
    ...presentation,
    TaskRow: (rowProps) => ({ type: "task-row", props: rowProps }),
    TaskBoard: (boardProps) => ({ type: "task-board", props: boardProps }),
    TaskFilterBar: (barProps) => ({ type: "task-filter-bar", props: barProps }),
    QuickAdd: (quickAddProps) => ({ type: "quick-add", props: quickAddProps }),
    QuickAddTrigger: (triggerProps) => ({ type: "quick-add-trigger", props: triggerProps }),
  };
});

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { dateOnlyKey } from "../domain/taskDomain";
import MyTasksPage from "./MyTasksPage";

const VIEW_KEY = "taskflow:my-tasks-view";
const GROUP_KEY = "taskflow:my-tasks-group";

const shiftDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateOnlyKey(date);
};

const todayKey = dateOnlyKey(new Date());
const yesterdayKey = shiftDay(-1);
const soonKey = shiftDay(3);

const projects = [
  { id: "project-1", name: "Billing", color: "#5b5bd6" },
  { id: "project-2", name: "Website", color: "#1f9d64" },
];

const buildTasks = () => [
  {
    id: "t-overdue",
    title: "Send invoice",
    status: "todo",
    priority: "high",
    completed: false,
    dueDate: yesterdayKey,
    projectId: null,
  },
  {
    id: "t-today",
    title: "Standup notes",
    status: "todo",
    priority: "medium",
    completed: false,
    dueDate: todayKey,
    projectId: null,
  },
  {
    id: "t-project",
    title: "Ship billing",
    status: "in-progress",
    priority: "low",
    completed: false,
    dueDate: soonKey,
    projectId: "project-1",
    projectName: "Billing",
  },
  {
    id: "t-done",
    title: "Tidy backlog",
    status: "completed",
    priority: "medium",
    completed: true,
    dueDate: yesterdayKey,
    completedAt: "2026-09-01T10:00:00.000Z",
    projectId: null,
  },
];

const buildActions = (overrides = {}) => ({
  pendingIds: new Set(),
  toggleComplete: vi.fn().mockResolvedValue(undefined),
  archive: vi.fn().mockResolvedValue(undefined),
  quickUpdate: vi.fn().mockResolvedValue(undefined),
  createPersonal: vi.fn().mockResolvedValue({ id: "task-new" }),
  ...overrides,
});

const storage = new Map();

const mountPage = (overrides = {}) => {
  const pageProps = {
    tasks: buildTasks(),
    projects,
    taskActions: buildActions(),
    onOpenTask: vi.fn(),
    onNewTask: vi.fn(),
    onRetry: vi.fn(),
    selectedTaskId: null,
    ...overrides,
  };
  const runner = runtime.createRunner(MyTasksPage);
  const tree = () => render(runner.render(), 8);
  runner.render(pageProps);
  return { pageProps, runner, tree };
};

const filterBar = (tree) => find(tree, (node) => node.type === "task-filter-bar");
const rows = (tree) => findAll(tree, (node) => node.type === "task-row");
const groupSections = (tree) =>
  findAll(
    tree,
    (node) =>
      node.type === "section" && String(props(node).className || "").startsWith("task-group")
  );
const groupLabels = (tree) =>
  findAll(tree, (node) => props(node).className === "task-group-label").map((node) =>
    textContent(node)
  );
const filterById = (tree, id) =>
  props(filterBar(tree)).filters.find((filter) => filter.id === id);
const segmentedOption = (tree, label) =>
  find(
    tree,
    (node) =>
      String(props(node).className || "").includes("segmented-option") &&
      textContent(node) === label
  );

beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  };
});

afterEach(() => {
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe("MyTasksPage header", () => {
  it("counts open tasks and opens the composer from New task", () => {
    const { pageProps, tree } = mountPage();
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "page-title-count"))).toBe(
      "3"
    );

    const newTask = find(
      view,
      (node) => node.type === "button" && textContent(node) === "New task"
    );
    newTask.props.onClick();
    expect(pageProps.onNewTask).toHaveBeenCalledWith();
  });

  it("reads the stored view and writes it back when the toggle changes", () => {
    storage.set(VIEW_KEY, "board");
    const { tree } = mountPage();

    expect(find(tree(), (node) => node.type === "task-board")).toBeDefined();

    segmentedOption(tree(), "List").props.onClick();
    expect(storage.get(VIEW_KEY)).toBe("list");
    expect(find(tree(), (node) => node.type === "task-board")).toBeUndefined();
    expect(rows(tree()).length).toBe(3);
  });

  it("ignores an unusable localStorage and falls back to the list view", () => {
    globalThis.window = {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    };

    const { tree } = mountPage();
    expect(find(tree(), (node) => node.type === "task-board")).toBeUndefined();
    expect(() => segmentedOption(tree(), "Board").props.onClick()).not.toThrow();
  });
});

describe("MyTasksPage list grouping", () => {
  it("groups by due date and hides completed tasks by default", () => {
    const { tree } = mountPage();
    const view = tree();

    expect(groupLabels(view)).toEqual(["Overdue", "Today", "Upcoming"]);
    expect(rows(view).map((row) => props(row).task.id)).toEqual([
      "t-overdue",
      "t-today",
      "t-project",
    ]);
  });

  it("adds the Completed group collapsed once Show completed is on", () => {
    const { tree } = mountPage();

    filterById(tree(), "my-tasks-completed").onChange(true);
    const view = tree();

    expect(groupLabels(view)).toEqual(["Overdue", "Today", "Upcoming", "Completed"]);

    const completedGroup = groupSections(view).find(
      (section) => props(section)["aria-label"] === "Completed"
    );
    expect(props(completedGroup).className).toContain("is-collapsed");
    expect(rows(completedGroup)).toEqual([]);

    const header = find(
      completedGroup,
      (node) => props(node).className === "task-group-header"
    );
    expect(props(header)["aria-expanded"]).toBe(false);
    header.props.onClick();
    const expanded = tree();
    const reopened = groupSections(expanded).find(
      (section) => props(section)["aria-label"] === "Completed"
    );
    expect(rows(reopened).map((row) => props(row).task.id)).toEqual(["t-done"]);
  });

  it("persists the group-by choice and regroups the list", () => {
    const { tree } = mountPage();

    props(filterBar(tree())).group.onChange("priority");
    expect(storage.get(GROUP_KEY)).toBe("priority");
    expect(groupLabels(tree())).toEqual(["High", "Medium", "Low"]);
  });

  it("starts from the stored group and drops the project badge when grouping by project", () => {
    storage.set(GROUP_KEY, "project");
    const { tree } = mountPage();

    expect(groupLabels(tree())).toEqual(["Billing", "Personal"]);
    expect(props(rows(tree())[0]).showProject).toBe(false);
  });

  it("sorts the rows inside a group", () => {
    const { tree } = mountPage();

    props(filterBar(tree())).group.onChange("status");
    props(filterBar(tree())).sort.onChange("title");
    expect(rows(tree()).map((row) => props(row).task.title)).toEqual([
      "Send invoice",
      "Standup notes",
      "Ship billing",
    ]);
  });
});

describe("MyTasksPage filters", () => {
  it("filters by source", () => {
    const { tree } = mountPage();

    filterById(tree(), "my-tasks-source").onChange("projects");
    expect(rows(tree()).map((row) => props(row).task.id)).toEqual(["t-project"]);

    filterById(tree(), "my-tasks-source").onChange("personal");
    expect(rows(tree()).map((row) => props(row).task.id)).toEqual(["t-overdue", "t-today"]);
  });

  it("filters by priority and by project", () => {
    const { tree } = mountPage();

    filterById(tree(), "my-tasks-priority").onChange("high");
    expect(rows(tree()).map((row) => props(row).task.id)).toEqual(["t-overdue"]);

    filterById(tree(), "my-tasks-priority").onChange("all");
    filterById(tree(), "my-tasks-project").onChange("project-1");
    expect(rows(tree()).map((row) => props(row).task.id)).toEqual(["t-project"]);
  });

  it("hides the project filter when there are no projects", () => {
    const { tree } = mountPage({ projects: [] });
    expect(filterById(tree(), "my-tasks-project")).toBeUndefined();
  });

  it("searches titles and clears every filter", () => {
    const { tree } = mountPage();

    props(filterBar(tree())).onSearch("invoice");
    expect(rows(tree()).map((row) => props(row).task.id)).toEqual(["t-overdue"]);
    expect(props(filterBar(tree())).activeCount).toBe(1);

    filterById(tree(), "my-tasks-priority").onChange("low");
    expect(props(filterBar(tree())).activeCount).toBe(2);

    props(filterBar(tree())).onClear();
    const cleared = tree();
    expect(props(filterBar(cleared)).activeCount).toBe(0);
    expect(props(filterBar(cleared)).search).toBe("");
    expect(rows(cleared).length).toBe(3);
  });

  it("explains an empty result instead of showing empty groups", () => {
    const { tree } = mountPage();

    props(filterBar(tree())).onSearch("nothing matches this");
    const view = tree();
    expect(textContent(find(view, (node) => props(node).className === "empty-state-title"))).toBe(
      "No tasks match these filters"
    );
    expect(rows(view)).toEqual([]);
  });
});

describe("MyTasksPage quick add", () => {
  it("creates a task dated today from the Today group", async () => {
    const { pageProps, tree } = mountPage();

    const todaySection = groupSections(tree()).find(
      (section) => props(section)["aria-label"] === "Today"
    );
    find(todaySection, (node) => node.type === "quick-add-trigger").props.onClick();

    const quickAdd = find(tree(), (node) => node.type === "quick-add");
    await quickAdd.props.onCreate("Water the plants");
    expect(pageProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Water the plants",
      dueDate: todayKey,
    });

    quickAdd.props.onOpenDetails("Water the plants");
    expect(pageProps.onNewTask).toHaveBeenCalledWith({
      title: "Water the plants",
      dueDate: todayKey,
    });
    expect(find(tree(), (node) => node.type === "quick-add")).toBeUndefined();
  });

  it("moves the quick add to the first group and drops the due date when not grouping by due", async () => {
    storage.set(GROUP_KEY, "priority");
    const { pageProps, tree } = mountPage();

    const firstGroup = groupSections(tree())[0];
    expect(props(firstGroup)["aria-label"]).toBe("High");
    find(firstGroup, (node) => node.type === "quick-add-trigger").props.onClick();

    const quickAdd = find(tree(), (node) => node.type === "quick-add");
    await quickAdd.props.onCreate("Later task");
    expect(pageProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Later task",
      dueDate: "",
    });

    quickAdd.props.onOpenDetails("Later task");
    expect(pageProps.onNewTask).toHaveBeenCalledWith({ title: "Later task", dueDate: "" });
  });

  it("offers a quick add in the empty state", async () => {
    const { pageProps, tree } = mountPage({ tasks: [] });
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "empty-state-title"))).toBe(
      "No tasks yet"
    );

    await find(view, (node) => node.type === "quick-add").props.onCreate("First task");
    expect(pageProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "First task",
      dueDate: todayKey,
    });
  });
});

describe("MyTasksPage rows", () => {
  it("wires open, completion and archive, and hides archive for project tasks", async () => {
    const { pageProps, tree } = mountPage();
    const [overdue, , projectRow] = rows(tree());

    props(overdue).onOpen(props(overdue).task, "row-element");
    expect(pageProps.onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-overdue" }),
      "row-element"
    );

    props(overdue).onToggleComplete(props(overdue).task);
    await Promise.resolve();
    expect(pageProps.taskActions.toggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-overdue" })
    );

    props(overdue).onArchive(props(overdue).task);
    await Promise.resolve();
    expect(pageProps.taskActions.archive).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-overdue" })
    );

    expect(props(projectRow).onArchive).toBeUndefined();
  });

  it("marks pending rows busy and highlights the selected task", () => {
    const { tree } = mountPage({
      selectedTaskId: "t-today",
      taskActions: buildActions({ pendingIds: new Set(["t-overdue"]) }),
    });
    const [overdue, today] = rows(tree());

    expect(props(overdue).busy).toBe(true);
    expect(props(today).busy).toBe(false);
    expect(props(today).selected).toBe(true);
    expect(props(overdue).selected).toBe(false);
  });

  it("shows a dismissible notice when a mutation fails", async () => {
    const taskActions = buildActions({
      toggleComplete: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { tree } = mountPage({ taskActions });

    props(rows(tree())[0]).onToggleComplete(props(rows(tree())[0]).task);
    await Promise.resolve();
    await Promise.resolve();

    const notice = find(tree(), (node) => props(node).className === "page-notice");
    expect(textContent(notice)).toContain("We couldn't update “Send invoice”");

    find(
      notice,
      (node) => node.type === "button" && props(node)["aria-label"] === "Dismiss"
    ).props.onClick();
    expect(find(tree(), (node) => props(node).className === "page-notice")).toBeUndefined();
  });
});

describe("MyTasksPage board", () => {
  const mountBoard = (overrides) => {
    storage.set(VIEW_KEY, "board");
    return mountPage(overrides);
  };

  it("renders the three personal columns with Done collapsed", () => {
    const { tree } = mountBoard();
    const board = find(tree(), (node) => node.type === "task-board");

    expect(props(board).columns).toEqual([
      { id: "todo", name: "To do", category: "todo" },
      { id: "in-progress", name: "In progress", category: "in_progress" },
      { id: "completed", name: "Done", category: "done" },
    ]);
    expect(props(board).initiallyCollapsedIds).toEqual(["completed"]);
    expect(props(board).tasks.map((task) => [task.id, task.columnId])).toEqual([
      ["t-overdue", "todo"],
      ["t-today", "todo"],
      ["t-project", "in-progress"],
      ["t-done", "completed"],
    ]);
  });

  it("turns a move into a status patch through quickUpdate", async () => {
    const { pageProps, tree } = mountBoard();
    const board = find(tree(), (node) => node.type === "task-board");

    await props(board).onMove([
      { taskId: "t-today", columnId: "completed", position: 0 },
      { taskId: "t-overdue", columnId: "todo", position: 0 },
    ]);

    expect(pageProps.taskActions.quickUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-today" }),
      { status: "completed", completed: true }
    );
  });

  it("reports a failed move", async () => {
    const taskActions = buildActions({
      quickUpdate: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { tree } = mountBoard({ taskActions });

    await props(find(tree(), (node) => node.type === "task-board")).onMove([
      { taskId: "t-today", columnId: "in-progress", position: 0 },
    ]);

    expect(textContent(find(tree(), (node) => props(node).className === "page-notice"))).toContain(
      "We couldn't move “Standup notes”"
    );
  });

  it("creates a task in the column it was added to", async () => {
    const { pageProps, tree } = mountBoard();
    const board = find(tree(), (node) => node.type === "task-board");

    await props(board).onQuickCreate("Draft brief", { id: "in-progress", name: "In progress" });
    expect(pageProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Draft brief",
      status: "in-progress",
      completed: false,
    });

    await props(board).onQuickCreate("Wrap up", { id: "completed", name: "Done" });
    expect(pageProps.taskActions.createPersonal).toHaveBeenLastCalledWith({
      title: "Wrap up",
      status: "completed",
      completed: true,
    });
  });

  it("hands a board Add details to the composer with the column status", () => {
    const { pageProps, tree } = mountBoard();
    const board = find(tree(), (node) => node.type === "task-board");

    props(board).onOpenDetails("Draft brief", { id: "in-progress", name: "In progress" });
    expect(pageProps.onNewTask).toHaveBeenCalledWith({
      title: "Draft brief",
      status: "in-progress",
    });
  });

  it("keeps grouping and completion controls out of the board toolbar", () => {
    const { tree } = mountBoard();
    const bar = filterBar(tree());

    expect(props(bar).group).toBeUndefined();
    expect(props(bar).sort).toBeUndefined();
    expect(filterById(tree(), "my-tasks-completed")).toBeUndefined();
  });
});

describe("MyTasksPage loading and error states", () => {
  it("shows three skeleton rows while loading", () => {
    const { tree } = mountPage({ tasksLoading: true });
    const view = tree();

    expect(props(find(view, (node) => props(node).role === "status"))["aria-label"]).toBe(
      "Loading tasks"
    );
    expect(findAll(view, (node) => props(node).className === "skeleton-row").length).toBe(3);
    expect(filterBar(view)).toBeUndefined();
  });

  it("offers a retry when the load failed", () => {
    const { pageProps, tree } = mountPage({ tasksError: "Tasks are unavailable." });
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "notice-body"))).toBe(
      "Tasks are unavailable."
    );
    find(view, (node) => node.type === "button" && textContent(node) === "Retry").props.onClick();
    expect(pageProps.onRetry).toHaveBeenCalled();
  });
});
