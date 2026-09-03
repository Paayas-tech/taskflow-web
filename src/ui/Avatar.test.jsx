import { describe, expect, it } from "vitest";
import { Avatar, AvatarStack, avatarColor } from "./Avatar";
import { findAll, render, textContent } from "../test/elementTree";

describe("Avatar", () => {
  it("renders uppercase initials from the first two words", () => {
    const output = Avatar({ name: "ada lovelace king", size: "md" });

    expect(textContent(output)).toBe("AL");
    expect(output.props.className).toBe("avatar avatar-md");
    expect(output.props.title).toBe("ada lovelace king");
  });

  it("falls back to a question mark and renders an image when a src is given", () => {
    expect(textContent(Avatar({ name: "" }))).toBe("?");

    const withImage = Avatar({ name: "Ada", src: "https://example.test/a.png" });
    expect(withImage.props.style).toBeUndefined();
    expect(withImage.props.children.props.className).toBe("avatar-image");
  });

  it("derives a stable color from the name", () => {
    expect(avatarColor("Ada Lovelace")).toBe(avatarColor("Ada Lovelace"));
    expect(avatarColor("Ada Lovelace")).not.toBe(avatarColor("Grace Hopper"));
  });
});

describe("AvatarStack", () => {
  it("caps the visible avatars and shows the overflow count", () => {
    const people = ["A One", "B Two", "C Three", "D Four", "E Five"].map((name) => ({ name }));
    const output = render(AvatarStack({ people, max: 3 }));

    expect(findAll(output, (node) => node.props.className?.includes("avatar-image"))).toHaveLength(0);
    expect(textContent(output)).toContain("+2");
    expect(findAll(output, (node) => node.props.className === "avatar avatar-sm")).toHaveLength(3);
  });
});
