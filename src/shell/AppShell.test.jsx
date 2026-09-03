import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { find, props, textContent } from "../test/elementTree";

const sidebar = { type: "aside", key: null, props: { className: "sidebar" } };
const page = { type: "section", key: null, props: { className: "page", children: "Home" } };

describe("AppShell", () => {
  it("puts the sidebar beside a scrolling main column", () => {
    const tree = AppShell({ sidebar, children: page });

    expect(props(tree).className).toBe("app-shell");
    expect(find(tree, (node) => props(node).className === "sidebar")).toBeDefined();
    expect(textContent(find(tree, (node) => node.type === "main"))).toBe("Home");
  });

  it("narrows the grid when the sidebar is collapsed", () => {
    expect(props(AppShell({ collapsed: true, sidebar, children: page })).className).toBe(
      "app-shell is-collapsed"
    );
  });

  it("shows a dismissible backdrop only while the mobile drawer is open", () => {
    expect(
      find(AppShell({ sidebar, children: page }), (node) =>
        props(node).className === "sidebar-backdrop"
      )
    ).toBeUndefined();

    const onMobileClose = vi.fn();
    const tree = AppShell({ sidebar, children: page, mobileOpen: true, onMobileClose });
    const backdrop = find(tree, (node) => props(node).className === "sidebar-backdrop");

    expect(props(tree).className).toBe("app-shell is-mobile-open");
    expect(props(backdrop)["aria-label"]).toBe("Close navigation");

    props(backdrop).onClick();
    expect(onMobileClose).toHaveBeenCalledOnce();
  });
});
