import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("announces itself as a loading status", () => {
    const output = Spinner({});

    expect(output.props.role).toBe("status");
    expect(output.props["aria-label"]).toBe("Loading");
    expect(output.props.className).toBe("spinner spinner-md");
  });

  it("supports the small size and extra class names", () => {
    const output = Spinner({ size: "sm", className: "is-inline" });

    expect(output.props.className).toBe("spinner spinner-sm is-inline");
  });
});
