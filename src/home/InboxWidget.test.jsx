import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, props, textContent } from "../test/elementTree";
import InboxWidget from "./InboxWidget";
import { WidgetSkeleton } from "./Widget";

const notification = (overrides = {}) => ({
  id: "notification",
  type: "comment_added",
  projectId: "apollo",
  taskId: "task-1",
  actorName: "Priya Shah",
  data: { taskTitle: "Ship release" },
  readAt: null,
  createdAt: "2026-09-02T09:00:00Z",
  ...overrides,
});

const notifications = [
  notification({ id: "1", createdAt: "2026-09-01T09:00:00Z", readAt: "2026-09-01T10:00:00Z" }),
  notification({ id: "2", type: "task_assigned", createdAt: "2026-09-02T09:00:00Z" }),
];

const baseProps = (overrides = {}) => ({
  notifications,
  onNavigate: vi.fn(),
  ...overrides,
});

const rows = (tree) =>
  findAll(tree, (node) => String(props(node).className || "").startsWith("widget-row inbox-row"));

describe("InboxWidget", () => {
  it("lists the newest notifications first and marks the unread ones", () => {
    const tree = InboxWidget(baseProps());
    const [newest, older] = rows(tree);

    expect(props(tree).title).toBe("Inbox");
    expect(textContent(newest)).toContain("You were assigned Ship release.");
    expect(props(newest).className).toContain("is-unread");
    expect(textContent(newest)).toContain("Unread");
    expect(textContent(newest)).toContain("Assignment");

    expect(props(older).className).not.toContain("is-unread");
    expect(textContent(older)).toContain("Priya Shah added a comment to Ship release.");
  });

  it("shows at most five notifications", () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      notification({ id: `n${index}`, createdAt: `2026-09-0${index + 1}T09:00:00Z` })
    );

    expect(rows(InboxWidget(baseProps({ notifications: many })))).toHaveLength(5);
  });

  it("opens the project a notification belongs to, and the inbox otherwise", () => {
    const widgetProps = baseProps({
      notifications: [notification({ id: "1" }), notification({ id: "2", projectId: null })],
    });
    const tree = InboxWidget(widgetProps);

    props(rows(tree)[0]).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/projects/apollo/overview");

    props(rows(tree)[1]).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/inbox");
  });

  it("links to the inbox from the header", () => {
    const widgetProps = baseProps();
    const tree = InboxWidget(widgetProps);

    props(props(tree).actions).onClick();
    expect(widgetProps.onNavigate).toHaveBeenCalledWith("/inbox");
  });

  it("says when there is nothing to read and skeletons while loading", () => {
    const empty = InboxWidget(baseProps({ notifications: [] }));
    expect(textContent(find(empty, (node) => props(node).className === "widget-empty muted"))).toBe(
      "You're all caught up."
    );

    const loading = InboxWidget(baseProps({ loading: true }));
    expect(find(loading, (node) => node.type === WidgetSkeleton)).toBeDefined();
    expect(rows(loading)).toHaveLength(0);
  });

  it("formats the timestamp with the viewer's clock preference", () => {
    const twelve = InboxWidget(baseProps({ formatSettings: { format: "12-hour" } }));
    const twentyFour = InboxWidget(baseProps({ formatSettings: { format: "24-hour" } }));
    const meta = (tree) =>
      textContent(find(tree, (node) => props(node).className === "inbox-row-meta muted"));

    expect(meta(twelve)).toMatch(/AM|PM/);
    expect(meta(twentyFour)).not.toMatch(/AM|PM/);
  });
});
