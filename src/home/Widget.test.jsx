import { describe, expect, it, vi } from "vitest";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import { Widget, WidgetError, WidgetSkeleton } from "./Widget";

describe("Widget", () => {
  it("names the region, renders the heading and keeps the body and footer apart", () => {
    const tree = Widget({
      title: "My tasks",
      actions: <button type="button">View all</button>,
      footer: <span className="footer-slot">footer</span>,
      children: <p className="row">A row</p>,
    });

    expect(tree.type).toBe("section");
    expect(props(tree).className).toBe("widget");
    expect(props(tree)["aria-label"]).toBe("My tasks");

    const heading = find(tree, (node) => node.type === "h2");
    expect(textContent(heading)).toBe("My tasks");
    expect(textContent(find(tree, (node) => props(node).className === "widget-actions"))).toBe(
      "View all"
    );
    expect(textContent(find(tree, (node) => props(node).className === "widget-body"))).toBe(
      "A row"
    );
    expect(textContent(find(tree, (node) => props(node).className === "widget-footer"))).toBe(
      "footer"
    );
  });

  it("omits the actions and footer slots when nothing is passed", () => {
    const tree = Widget({ title: "Inbox", className: "inbox-widget", children: null });

    expect(props(tree).className).toBe("widget inbox-widget");
    expect(find(tree, (node) => props(node).className === "widget-actions")).toBeUndefined();
    expect(find(tree, (node) => props(node).className === "widget-footer")).toBeUndefined();
  });
});

describe("WidgetSkeleton", () => {
  it("announces the load and draws one placeholder per row", () => {
    const tree = WidgetSkeleton({ rows: 2, label: "Loading tasks" });

    expect(props(tree).role).toBe("status");
    expect(props(tree)["aria-label"]).toBe("Loading tasks");
    expect(findAll(tree, (node) => props(node).className === "skeleton-row")).toHaveLength(2);
  });
});

describe("WidgetError", () => {
  it("shows the message with a retry button", () => {
    const onRetry = vi.fn();
    const tree = render(WidgetError({ message: "Tasks are unavailable.", onRetry }));

    expect(textContent(tree)).toContain("Tasks are unavailable.");

    const retry = find(tree, (node) => textContent(node) === "Retry" && node.type === "button");
    props(retry).onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("drops the retry button when the page has no retry", () => {
    const tree = render(WidgetError({ message: "Tasks are unavailable." }));
    expect(find(tree, (node) => textContent(node) === "Retry")).toBeUndefined();
  });
});
