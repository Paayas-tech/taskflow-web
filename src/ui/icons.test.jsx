import { describe, expect, it } from "vitest";
import { Icon, PriorityIcon, StatusIcon, iconNames } from "./icons";
import { findAll, textContent } from "../test/elementTree";

describe("Icon", () => {
  it("renders a decorative 24-grid svg at the requested size", () => {
    const output = Icon({ name: "calendar", size: 20 });

    expect(output.type).toBe("svg");
    expect(output.props.viewBox).toBe("0 0 24 24");
    expect(output.props["aria-hidden"]).toBe("true");
    expect(output.props.width).toBe(20);
  });

  it("provides every name the spec lists and renders nothing for unknown names", () => {
    const required = ["home", "check-square", "checklist", "calendar", "inbox", "folder", "folders",
      "plus", "search", "settings", "chevron-down", "chevron-right", "chevron-left", "chevron-up",
      "more-horizontal", "more-vertical", "flag", "user", "users", "layout-board", "list", "book",
      "archive", "archive-restore", "trash", "x", "bell", "filter", "arrow-up-down", "clock",
      "paperclip", "message-circle", "activity", "check", "circle", "circle-dot", "circle-check",
      "panel-left", "panel-right", "external-link", "log-out", "edit", "copy", "calendar-plus",
      "alert-circle", "info", "sun", "moon", "layers", "tag", "grip-vertical", "refresh",
      "arrow-left", "arrow-right", "mail", "star", "eye", "link"];

    expect(required.filter((name) => !iconNames.includes(name))).toEqual([]);
    expect(Icon({ name: "not-an-icon" })).toBeNull();
  });
});

describe("StatusIcon", () => {
  it("marks each status with its own modifier class", () => {
    expect(StatusIcon({ status: "todo" }).props.className).toBe("status-icon is-todo");
    expect(StatusIcon({ status: "in-progress" }).props.className).toBe("status-icon is-in-progress");
    expect(StatusIcon({ status: "completed" }).props.className).toBe("status-icon is-completed");
    expect(StatusIcon({ status: "unknown" }).props.className).toBe("status-icon is-todo");
  });
});

describe("PriorityIcon", () => {
  it("labels the priority and fills one bar per level", () => {
    const output = PriorityIcon({ priority: "high" });

    expect(output.props.role).toBe("img");
    expect(output.props["aria-label"]).toBe("High priority");
    expect(textContent(output)).toContain("High priority");
    expect(findAll(output, (node) => node.props.className === "priority-bar is-on")).toHaveLength(3);
  });

  it("dims the unused bars for low priority", () => {
    const output = PriorityIcon({ priority: "low" });

    expect(findAll(output, (node) => node.props.className === "priority-bar is-on")).toHaveLength(1);
    expect(findAll(output, (node) => node.props.className === "priority-bar is-off")).toHaveLength(2);
  });
});
