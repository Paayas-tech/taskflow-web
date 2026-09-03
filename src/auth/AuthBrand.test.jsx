import { describe, expect, it } from "vitest";
import { find, render, textContent } from "../test/elementTree";
import AuthBrand from "./AuthBrand";

describe("auth brand", () => {
  it("shows the wordmark and hides the decorative mark from assistive tech", () => {
    const tree = render(AuthBrand());

    expect(textContent(tree)).toBe("TaskFlow");
    expect(
      find(tree, (node) => node.props.className === "auth-mark").props["aria-hidden"]
    ).toBe("true");
  });
});
