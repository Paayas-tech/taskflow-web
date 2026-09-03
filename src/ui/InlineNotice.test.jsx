import { describe, expect, it, vi } from "vitest";
import { InlineNotice } from "./InlineNotice";
import { find, findByRole, render, textContent } from "../test/elementTree";

describe("InlineNotice", () => {
  it("announces errors with role alert and other tones with role status", () => {
    expect(InlineNotice({ tone: "error", children: "Could not load" }).props.role).toBe("alert");
    expect(InlineNotice({ tone: "info", children: "Heads up" }).props.role).toBe("status");
    expect(InlineNotice({ tone: "success", children: "Saved" }).props.className).toBe("notice notice-success");
  });

  it("renders the message and an action slot", () => {
    const output = InlineNotice({ tone: "error", children: "Could not load", action: "retry" });

    expect(textContent(find(output, (node) => node.props.className === "notice-body"))).toBe("Could not load");
    expect(textContent(find(output, (node) => node.props.className === "notice-actions"))).toBe("retry");
  });

  it("shows a dismiss button only when onDismiss is given", () => {
    const onDismiss = vi.fn();
    const output = render(InlineNotice({ tone: "info", children: "Heads up", onDismiss }));
    const dismiss = findByRole(output, "button", { name: "Dismiss" });

    dismiss.props.onClick();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(findByRole(render(InlineNotice({ children: "Heads up" })), "button")).toBeUndefined();
  });
});
