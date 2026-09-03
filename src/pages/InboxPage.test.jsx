import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, findByRole, findByText, props, render, textContent } from "../test/elementTree";
import { InboxPage } from "./InboxPage";

const assigned = {
  id: "n-assigned",
  type: "task_assigned",
  readAt: null,
  createdAt: "2026-09-02T09:30:00.000Z",
  projectId: "project a",
  data: { taskTitle: "Ship the beta", actorId: "user-2" },
  actorName: "Priya Shah",
};

const mention = {
  id: "n-mention",
  type: "mentioned",
  readAt: "2026-09-02T08:00:00.000Z",
  createdAt: "2026-09-02T07:45:00.000Z",
  projectId: "project-b",
  data: { taskTitle: "Write the changelog", actorId: "user-3" },
  actorName: "Sam Diaz",
};

const comment = {
  id: "n-comment",
  type: "comment_added",
  readAt: null,
  createdAt: "2026-09-01T18:10:00.000Z",
  projectId: null,
  data: { taskTitle: "Fix the header", actorId: "user-4" },
  actorName: "Ana Roy",
};

const pageProps = (overrides = {}) => ({
  notifications: [assigned, mention, comment],
  loading: false,
  error: "",
  liveNotice: "",
  onMarkRead: vi.fn(() => Promise.resolve()),
  onMarkAllRead: vi.fn(() => Promise.resolve()),
  onDismiss: vi.fn(() => Promise.resolve()),
  onRefresh: vi.fn(),
  onNavigate: vi.fn(),
  onOpenSettings: vi.fn(),
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const hasClass = (node, className) =>
  String(props(node).className || "").split(" ").includes(className);

const renderPage = (overrides) => render(InboxPage(pageProps(overrides)));

const view = (runner, overrides) =>
  render(overrides ? runner.render(pageProps(overrides)) : runner.render());

const rows = (tree) => findAll(tree, (node) => hasClass(node, "inbox-item"));
const tabs = (tree) => findAll(tree, (node) => props(node).role === "tab");
const button = (tree, name) => findByRole(tree, "button", { name });

describe("InboxPage header", () => {
  it("counts all, unread and mentioned notifications on the tabs", () => {
    const tree = renderPage();

    expect(tabs(tree).map((tab) => textContent(tab))).toEqual([
      "All 3",
      "Unread 2",
      "Mentions 1",
    ]);
    expect(props(tabs(tree)[0])["aria-selected"]).toBe(true);
  });

  it("filters the list when another tab is selected", () => {
    const runner = runtime.createRunner(InboxPage);
    const all = view(runner, {});
    expect(rows(all)).toHaveLength(3);

    props(tabs(all)[1]).onClick();
    const unread = view(runner);
    expect(rows(unread).map((row) => textContent(find(row, (node) => hasClass(node, "inbox-item-label"))))).toEqual([
      "You were assigned Ship the beta.",
      "Ana Roy added a comment to Fix the header.",
    ]);

    props(tabs(unread)[2]).onClick();
    const mentions = view(runner);
    expect(rows(mentions)).toHaveLength(1);
    expect(textContent(rows(mentions)[0])).toContain("Sam Diaz mentioned you on Write the changelog.");
  });

  it("disables mark all read when everything has been read", () => {
    const tree = renderPage({ notifications: [mention] });

    expect(props(button(tree, "Mark all read")).disabled).toBe(true);
  });

  it("marks everything read and stays busy until the request settles", async () => {
    let settle;
    const onMarkAllRead = vi.fn(() => new Promise((resolve) => {
      settle = resolve;
    }));
    const runner = runtime.createRunner(InboxPage);
    const idle = view(runner, { onMarkAllRead });

    expect(props(button(idle, "Mark all read")).disabled).toBe(false);
    props(button(idle, "Mark all read")).onClick();
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    const busy = view(runner);
    expect(props(button(busy, "Mark all read"))["aria-busy"]).toBe(true);
    expect(props(button(busy, "Mark all read")).disabled).toBe(true);

    settle();
    await flush();
    expect(props(button(view(runner), "Mark all read"))["aria-busy"]).toBeUndefined();
  });

  it("opens notification settings from the header", () => {
    const onOpenSettings = vi.fn();
    const tree = renderPage({ onOpenSettings });

    props(button(tree, "Notification settings")).onClick();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe("InboxPage rows", () => {
  it("shows the label, type, time and unread marker of each notification", () => {
    const tree = renderPage();
    const [first, second] = rows(tree);

    expect(hasClass(first, "is-unread")).toBe(true);
    expect(textContent(find(first, (node) => hasClass(node, "inbox-item-label")))).toBe(
      "You were assigned Ship the beta."
    );
    const meta = find(first, (node) => hasClass(node, "inbox-item-meta"));
    expect(textContent(meta)).toContain("Assignment");
    expect(props(find(meta, (node) => node.type === "time")).dateTime).toBe(assigned.createdAt);
    expect(props(findByRole(first, "img", { name: "Unread" })).className).toBe("inbox-item-dot");

    expect(hasClass(second, "is-unread")).toBe(false);
    expect(findByRole(second, "img", { name: "Unread" })).toBeUndefined();
    expect(textContent(find(second, (node) => hasClass(node, "inbox-item-meta")))).toContain("Mention");
  });

  it("marks an unread notification read and navigates to its project", async () => {
    const onMarkRead = vi.fn(() => Promise.resolve());
    const onNavigate = vi.fn();
    const tree = renderPage({ onMarkRead, onNavigate });

    props(rows(tree)[0]).onClick();
    await flush();

    expect(onMarkRead).toHaveBeenCalledWith("n-assigned");
    expect(onNavigate).toHaveBeenCalledWith("/projects/project%20a/overview");
  });

  it("navigates without marking an already read notification", async () => {
    const onMarkRead = vi.fn(() => Promise.resolve());
    const onNavigate = vi.fn();
    const tree = renderPage({ onMarkRead, onNavigate, notifications: [mention] });

    props(rows(tree)[0]).onClick();
    await flush();

    expect(onMarkRead).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith("/projects/project-b/overview");
  });

  it("marks a notification without a project read and stays on the page", async () => {
    const onMarkRead = vi.fn(() => Promise.resolve());
    const onNavigate = vi.fn();
    const tree = renderPage({ onMarkRead, onNavigate, notifications: [comment] });

    const preventDefault = vi.fn();
    props(rows(tree)[0]).onKeyDown({ key: "Enter", preventDefault });
    await flush();

    expect(preventDefault).toHaveBeenCalled();
    expect(onMarkRead).toHaveBeenCalledWith("n-comment");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("dismisses a notification without opening it", async () => {
    const onDismiss = vi.fn(() => Promise.resolve());
    const onNavigate = vi.fn();
    const tree = renderPage({ onDismiss, onNavigate });
    const row = rows(tree)[0];
    const dismiss = findByRole(row, "button", {
      name: "Dismiss: You were assigned Ship the beta.",
    });
    const stopPropagation = vi.fn();

    props(find(row, (node) => hasClass(node, "inbox-item-actions"))).onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();

    props(dismiss).onClick();
    await flush();
    expect(onDismiss).toHaveBeenCalledWith("n-assigned");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("marks the pending row busy while a dismissal is in flight", async () => {
    let settle;
    const onDismiss = vi.fn(() => new Promise((resolve) => {
      settle = resolve;
    }));
    const runner = runtime.createRunner(InboxPage);
    const idle = view(runner, { onDismiss });

    props(findByRole(rows(idle)[0], "button", {
      name: "Dismiss: You were assigned Ship the beta.",
    })).onClick();

    const busy = view(runner);
    expect(props(rows(busy)[0])["aria-busy"]).toBe(true);
    expect(props(rows(busy)[1])["aria-busy"]).toBeUndefined();

    settle();
    await flush();
    expect(props(rows(view(runner))[0])["aria-busy"]).toBeUndefined();
  });
});

describe("InboxPage states", () => {
  it("renders skeleton rows while loading", () => {
    const tree = renderPage({ loading: true, notifications: [] });

    expect(props(findByRole(tree, "status", { name: "Loading notifications" })).className).toBe(
      "row-list"
    );
    expect(findAll(tree, (node) => hasClass(node, "skeleton-row"))).toHaveLength(3);
    expect(rows(tree)).toHaveLength(0);
  });

  it("shows an empty state per tab", () => {
    const tree = renderPage({ notifications: [] });

    expect(textContent(find(tree, (node) => hasClass(node, "empty-state-title")))).toBe(
      "You're all caught up"
    );
    expect(textContent(find(tree, (node) => hasClass(node, "empty-state-description")))).toBe(
      "Assignments, comments and mentions land here."
    );

    const runner = runtime.createRunner(InboxPage);
    const all = view(runner, { notifications: [mention] });
    props(tabs(all)[1]).onClick();
    expect(
      textContent(find(view(runner), (node) => hasClass(node, "empty-state-description")))
    ).toBe("Every notification has been read.");
  });

  it("shows the live notice as an info notice", () => {
    const tree = renderPage({ liveNotice: "Live updates are paused." });
    const notice = find(tree, (node) => hasClass(node, "notice-info"));

    expect(props(notice).role).toBe("status");
    expect(textContent(notice)).toContain("Live updates are paused.");
  });

  it("shows an error notice with a retry action and keeps the list", () => {
    const onRefresh = vi.fn();
    const tree = renderPage({ error: "Inbox is temporarily unavailable.", onRefresh });
    const notice = find(tree, (node) => hasClass(node, "notice-error"));

    expect(props(notice).role).toBe("alert");
    expect(textContent(notice)).toContain("Inbox is temporarily unavailable.");
    props(findByText(notice, "Retry")).onClick();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(rows(tree)).toHaveLength(3);
  });
});
