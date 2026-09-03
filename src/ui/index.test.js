import { describe, expect, it } from "vitest";
import * as ui from "./index";

describe("ui barrel", () => {
  it("re-exports every primitive other packages code against", () => {
    const expected = [
      "Avatar", "AvatarStack", "avatarColor", "Badge", "Button", "IconButton", "Dialog",
      "ConfirmDialog", "EmptyState", "Field", "Input", "Textarea", "Select", "Checkbox",
      "Icon", "StatusIcon", "PriorityIcon", "InlineNotice", "Kbd", "Menu", "SegmentedControl",
      "SidePanel", "Spinner", "Tabs", "usePopover",
    ];

    expect(expected.filter((name) => typeof ui[name] !== "function")).toEqual([]);
  });

  it("exports the icon catalogue", () => {
    expect(Array.isArray(ui.iconNames)).toBe(true);
    expect(ui.iconNames).toContain("check-square");
  });
});
