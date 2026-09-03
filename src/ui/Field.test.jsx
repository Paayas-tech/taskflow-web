import { describe, expect, it, vi } from "vitest";
import { Checkbox, Field, Input, Select, Textarea } from "./Field";
import { find, findByRole, textContent } from "../test/elementTree";

describe("Field", () => {
  it("labels the control and shows a hint", () => {
    const output = Field({ label: "Due date", hint: "Optional", htmlFor: "due", children: "control" });

    expect(output.props.className).toBe("field");
    expect(find(output, (node) => node.type === "label").props.htmlFor).toBe("due");
    expect(textContent(find(output, (node) => node.props.className === "field-hint"))).toBe("Optional");
  });

  it("replaces the hint with an alert when there is an error", () => {
    const output = Field({ label: "Title", hint: "Optional", error: "Enter a title", inline: true, children: null });

    expect(output.props.className).toBe("field field-inline");
    expect(find(output, (node) => node.props.className === "field-hint")).toBeUndefined();
    expect(findByRole(output, "alert").props.className).toBe("field-error");
  });
});

describe("Input, Textarea and Select", () => {
  it("flag invalid controls for assistive tech", () => {
    expect(Input({ invalid: true }).props["aria-invalid"]).toBe(true);
    expect(Input({ invalid: true }).props.className).toBe("input is-invalid");
    expect(Textarea({}).props.className).toBe("textarea");
    expect(Textarea({}).props["aria-invalid"]).toBeUndefined();
    expect(Select({ children: null }).props.className).toBe("select");
  });

  it("forwards refs and native props", () => {
    const ref = { current: null };
    const onChange = vi.fn();
    const output = Input({ ref, value: "Ada", onChange, placeholder: "Name" });

    expect(output.props.ref).toBe(ref);
    expect(output.props.placeholder).toBe("Name");
    output.props.onChange();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Checkbox", () => {
  it("wraps a native checkbox in a label", () => {
    const output = Checkbox({ label: "Show completed", checked: true, onChange: vi.fn() });

    expect(output.type).toBe("label");
    expect(output.props.className).toBe("checkbox");
    expect(find(output, (node) => node.type === "input").props.type).toBe("checkbox");
    expect(textContent(output)).toBe("Show completed");
  });
});
