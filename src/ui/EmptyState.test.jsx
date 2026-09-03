import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { find, render, textContent } from "../test/elementTree";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    const output = EmptyState({ title: "No projects yet", description: "Projects hold a board." });

    expect(output.props.className).toBe("empty-state");
    expect(textContent(find(output, (node) => node.props.className === "empty-state-title"))).toBe("No projects yet");
    expect(textContent(output)).toContain("Projects hold a board.");
  });

  it("accepts an icon name and renders it as an Icon", () => {
    const output = render(EmptyState({ icon: "folders", title: "No projects yet" }));

    expect(find(output, (node) => node.type === "svg")).toBeDefined();
  });

  it("renders an action slot only when given", () => {
    const withAction = EmptyState({ title: "No tasks", action: { type: "button", props: {} } });

    expect(find(withAction, (node) => node.props.className === "empty-state-action")).toBeDefined();
    expect(find(EmptyState({ title: "No tasks" }), (node) => node.props.className === "empty-state-action")).toBeUndefined();
  });
});
