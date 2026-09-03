import { describe, expect, it } from "vitest";
import { Kbd } from "./Kbd";
import { textContent } from "../test/elementTree";

describe("Kbd", () => {
  it("renders a kbd element with the shortcut", () => {
    const output = Kbd({ children: "K" });

    expect(output.type).toBe("kbd");
    expect(output.props.className).toBe("kbd");
    expect(textContent(output)).toBe("K");
  });

  it("keeps extra class names and props", () => {
    const output = Kbd({ className: "is-quiet", title: "Command K", children: "K" });

    expect(output.props.className).toBe("kbd is-quiet");
    expect(output.props.title).toBe("Command K");
  });
});
