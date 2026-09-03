import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";
import { findAll } from "../test/elementTree";

const options = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
];

describe("SegmentedControl", () => {
  it("renders a labelled group of options", () => {
    const output = SegmentedControl({ options, value: "list", ariaLabel: "View" });

    expect(output.props.role).toBe("group");
    expect(output.props["aria-label"]).toBe("View");
    expect(output.props.className).toBe("segmented");
    expect(findAll(output, (node) => node.props.className?.startsWith("segmented-option"))).toHaveLength(2);
  });

  it("presses the active option", () => {
    const buttons = findAll(
      SegmentedControl({ options, value: "board", size: "sm" }),
      (node) => node.props.className?.startsWith("segmented-option")
    );

    expect(buttons[0].props["aria-pressed"]).toBe(false);
    expect(buttons[1].props["aria-pressed"]).toBe(true);
    expect(buttons[1].props.className).toBe("segmented-option is-active");
  });

  it("uses the small size class and reports selections", () => {
    const onChange = vi.fn();
    const output = SegmentedControl({ options, value: "list", size: "sm", onChange });

    expect(output.props.className).toBe("segmented segmented-sm");
    findAll(output, (node) => node.props.className?.startsWith("segmented-option"))[1].props.onClick();
    expect(onChange).toHaveBeenCalledWith("board");
  });
});
