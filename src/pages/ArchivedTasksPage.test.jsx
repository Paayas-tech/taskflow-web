import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

vi.mock("../tasks", () => ({
  TaskRow: (rowProps) => ({ type: "task-row", props: rowProps }),
}));

vi.mock("../components/modal/useModalLifecycle", () => ({
  useModalLifecycle: () => ({ onBackdropMouseDown: () => {} }),
}));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import ArchivedTasksPage from "./ArchivedTasksPage";

const buildTasks = () => [
  {
    id: "t-1",
    title: "Send invoice",
    status: "todo",
    priority: "high",
    completed: false,
    dueDate: "",
    projectId: null,
    archivedAt: "2026-08-20T09:00:00.000Z",
  },
  {
    id: "t-2",
    title: "Tidy backlog",
    status: "completed",
    priority: "low",
    completed: true,
    dueDate: "",
    projectId: null,
    archivedAt: "2026-08-21T09:00:00.000Z",
  },
];

const buildActions = (overrides = {}) => ({
  restore: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mountPage = (overrides = {}) => {
  const pageProps = {
    tasks: buildTasks(),
    loading: false,
    error: "",
    onRetry: vi.fn(),
    taskActions: buildActions(),
    onOpenTask: vi.fn(),
    onBack: vi.fn(),
    projects: [],
    ...overrides,
  };
  const runner = runtime.createRunner(ArchivedTasksPage);
  const tree = () => render(runner.render(), 8);
  runner.render(pageProps);
  return { pageProps, runner, tree };
};

const rows = (tree) => findAll(tree, (node) => node.type === "task-row");
const buttonByText = (tree, label) =>
  find(tree, (node) => node.type === "button" && textContent(node) === label);
const dialog = (tree) => find(tree, (node) => props(node).role === "alertdialog");
const notice = (tree) => find(tree, (node) => props(node).className === "page-notice");

beforeEach(() => {
  globalThis.window = { localStorage: { getItem: () => null, setItem: () => {} } };
});

afterEach(() => {
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe("ArchivedTasksPage", () => {
  it("titles the page with the archive count and links back to settings", () => {
    const { pageProps, tree } = mountPage();
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "page-title"))).toBe(
      "Archived tasks 2"
    );

    buttonByText(view, "Back to settings").props.onClick();
    expect(pageProps.onBack).toHaveBeenCalled();
  });

  it("lists every archived task with restore and delete affordances", () => {
    const { pageProps, tree } = mountPage();
    const view = tree();

    expect(rows(view).map((row) => props(row).task.title)).toEqual([
      "Send invoice",
      "Tidy backlog",
    ]);

    const [first] = rows(view);
    expect(props(first).onRestore).toBeTypeOf("function");
    expect(props(first).onDeletePermanently).toBeTypeOf("function");
    expect(props(first).onOpen).toBe(pageProps.onOpenTask);
    expect(props(first).busy).toBe(false);
  });

  it("restores a task through taskActions", async () => {
    const { pageProps, tree } = mountPage();

    props(rows(tree())[0]).onRestore(props(rows(tree())[0]).task);
    await Promise.resolve();

    expect(pageProps.taskActions.restore).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-1" })
    );
    expect(notice(tree())).toBeUndefined();
  });

  it("marks the row busy while a restore is in flight", () => {
    const taskActions = buildActions({ restore: vi.fn(() => new Promise(() => {})) });
    const { tree } = mountPage({ taskActions });

    props(rows(tree())[0]).onRestore(props(rows(tree())[0]).task);
    const view = tree();

    expect(props(rows(view)[0]).busy).toBe(true);
    expect(props(rows(view)[1]).busy).toBe(false);
  });

  it("confirms before deleting permanently and then calls remove", async () => {
    const { pageProps, tree } = mountPage();

    expect(dialog(tree())).toBeUndefined();

    props(rows(tree())[1]).onDeletePermanently(props(rows(tree())[1]).task);
    const confirming = tree();
    const confirmDialog = dialog(confirming);

    expect(textContent(find(confirmDialog, (node) => props(node).className === "dialog-title"))).toBe(
      "Delete permanently?"
    );
    expect(
      textContent(find(confirmDialog, (node) => props(node).className === "dialog-description"))
    ).toContain("Tidy backlog");

    await buttonByText(confirming, "Delete permanently").props.onClick();
    expect(pageProps.taskActions.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-2" })
    );
    expect(dialog(tree())).toBeUndefined();
  });

  it("keeps the task when the confirmation is cancelled", () => {
    const { pageProps, tree } = mountPage();

    props(rows(tree())[0]).onDeletePermanently(props(rows(tree())[0]).task);
    buttonByText(tree(), "Cancel").props.onClick();

    expect(dialog(tree())).toBeUndefined();
    expect(pageProps.taskActions.remove).not.toHaveBeenCalled();
  });

  it("surfaces a dismissible notice when restoring fails", async () => {
    const taskActions = buildActions({
      restore: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { tree } = mountPage({ taskActions });

    props(rows(tree())[0]).onRestore(props(rows(tree())[0]).task);
    await Promise.resolve();
    await Promise.resolve();

    const errorNotice = notice(tree());
    expect(textContent(errorNotice)).toContain("We couldn't restore “Send invoice”");

    find(
      errorNotice,
      (node) => node.type === "button" && props(node)["aria-label"] === "Dismiss"
    ).props.onClick();
    expect(notice(tree())).toBeUndefined();
  });

  it("keeps the dialog open when the delete fails", async () => {
    const taskActions = buildActions({
      remove: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { tree } = mountPage({ taskActions });

    props(rows(tree())[0]).onDeletePermanently(props(rows(tree())[0]).task);
    await buttonByText(tree(), "Delete permanently").props.onClick();

    expect(dialog(tree())).toBeDefined();
    expect(textContent(notice(tree()))).toContain("We couldn't delete “Send invoice”");
  });

  it("shows an empty state when nothing is archived", () => {
    const { tree } = mountPage({ tasks: [] });
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "empty-state-title"))).toBe(
      "No archived tasks"
    );
    expect(rows(view)).toEqual([]);
  });

  it("shows skeleton rows while loading", () => {
    const { tree } = mountPage({ loading: true });
    const view = tree();

    expect(props(find(view, (node) => props(node).role === "status"))["aria-label"]).toBe(
      "Loading archived tasks"
    );
    expect(findAll(view, (node) => props(node).className === "skeleton-row").length).toBe(3);
  });

  it("offers a retry when the archive fails to load", () => {
    const { pageProps, tree } = mountPage({ error: "Archived tasks are unavailable." });
    const view = tree();

    expect(textContent(find(view, (node) => props(node).className === "notice-body"))).toBe(
      "Archived tasks are unavailable."
    );
    buttonByText(view, "Retry").props.onClick();
    expect(pageProps.onRetry).toHaveBeenCalled();
    expect(rows(view)).toEqual([]);
  });
});
