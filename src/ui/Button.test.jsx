import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "./Button";
import { find, findByRole, props, render, textContent } from "../test/elementTree";

describe("Button", () => {
  it("applies the variant and size classes and defaults to type button", () => {
    const output = Button({ variant: "primary", size: "sm", children: "Create task" });

    expect(output.props.className).toBe("btn btn-primary btn-sm");
    expect(output.props.type).toBe("button");
    expect(textContent(output)).toContain("Create task");
  });

  it("shows a spinner, marks itself busy and disables while loading", () => {
    const output = render(Button({ loading: true, children: "Saving" }));

    expect(output.props.className).toContain("is-loading");
    expect(output.props.disabled).toBe(true);
    expect(output.props["aria-busy"]).toBe(true);
    expect(findByRole(output, "status")).toBeDefined();
  });

  it("renders a leading icon only when it is not loading", () => {
    const icon = { type: "svg", props: {} };

    expect(find(Button({ icon, children: "Add" }), (node) => node.props.className === "btn-leading")).toBeDefined();
    expect(find(Button({ icon, loading: true, children: "Add" }), (node) => node.props.className === "btn-leading")).toBeUndefined();
  });

  it("forwards clicks and extra props", () => {
    const onClick = vi.fn();
    const output = Button({ onClick, "data-testid": "save", children: "Save" });

    output.props.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(props(output)["data-testid"]).toBe("save");
  });
});

describe("IconButton", () => {
  it("uses the label for aria-label and title", () => {
    const output = IconButton({ label: "More actions", size: "sm", children: "icon" });

    expect(output.props["aria-label"]).toBe("More actions");
    expect(output.props.title).toBe("More actions");
    expect(output.props.className).toBe("btn btn-icon btn-ghost btn-sm");
  });
});
