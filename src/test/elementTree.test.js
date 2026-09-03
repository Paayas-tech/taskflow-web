import { describe, expect, it } from "vitest";
import {
  find,
  findAll,
  findByRole,
  findByText,
  props,
  render,
  textContent,
} from "./elementTree";

const element = (type, elementProps = {}, ...children) => ({
  type,
  props: children.length > 0 ? { ...elementProps, children } : elementProps,
});

const Greeting = ({ name }) => element("p", { className: "greeting" }, "Hello", name);
const Panel = ({ name }) =>
  element("div", { className: "panel" }, element(Greeting, { name }), element("button", { type: "button" }, "Close"));

describe("elementTree helpers", () => {
  it("reads text from nested children and arrays", () => {
    const tree = element("div", {}, "One", ["Two", element("span", {}, "Three")], null, false);

    expect(textContent(tree)).toBe("One Two Three");
  });

  it("finds single and multiple matches by predicate", () => {
    const tree = element(
      "ul",
      { className: "row-list" },
      element("li", { className: "row" }, "a"),
      element("li", { className: "row" }, "b")
    );

    expect(props(find(tree, (node) => node.type === "li")).children).toEqual(["a"]);
    expect(findAll(tree, (node) => node.props.className === "row")).toHaveLength(2);
  });

  it("finds the most specific element by text and by role", () => {
    const tree = element(
      "div",
      {},
      element("h1", {}, "Projects"),
      element("button", { type: "button", "aria-label": "New project" }, "New")
    );

    expect(findByText(tree, "Projects").type).toBe("h1");
    expect(findByRole(tree, "heading").type).toBe("h1");
    expect(findByRole(tree, "button", { name: "New project" }).props.type).toBe("button");
  });

  it("expands function components so compositions can be asserted", () => {
    const tree = render(element(Panel, { name: "Ada" }));

    expect(textContent(tree)).toContain("Hello Ada");
    expect(find(tree, (node) => node.props.className === "greeting")).toBeDefined();
    expect(findByRole(tree, "button")).toBeDefined();
  });

  it("stops expanding at the requested depth", () => {
    const tree = render(element(Panel, { name: "Ada" }), 1);

    expect(find(tree, (node) => node.type === Greeting)).toBeDefined();
  });
});
