import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { find, textContent } from "../test/elementTree";

describe("Badge", () => {
  it("defaults to the neutral tone", () => {
    const output = Badge({ children: "Owner" });

    expect(output.props.className).toBe("badge badge-neutral");
    expect(textContent(output)).toBe("Owner");
  });

  it("applies the requested tone and keeps extra class names", () => {
    const output = Badge({ tone: "danger", className: "is-pinned", children: "Overdue" });

    expect(output.props.className).toBe("badge badge-danger is-pinned");
  });

  it("renders a leading dot when asked", () => {
    const output = Badge({ tone: "success", dot: true, children: "Live" });

    expect(find(output, (node) => node.props.className === "badge-dot")).toBeDefined();
    expect(find(Badge({ children: "Live" }), (node) => node.props.className === "badge-dot")).toBeUndefined();
  });
});
