import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, Field, Input, Select, Textarea } from "./Field";

describe("Field", () => {
  it("labels its control and shows the hint", () => {
    render(
      <Field label="Title" hint="Keep it short" htmlFor="title">
        <Input id="title" />
      </Field>
    );

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByText("Keep it short")).toBeInTheDocument();
  });

  it("replaces the hint with an alert when there is an error", () => {
    render(
      <Field label="Title" hint="Keep it short" error="Title is required" htmlFor="title">
        <Input id="title" invalid />
      </Field>
    );

    expect(screen.queryByText("Keep it short")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("inputs", () => {
  it("types into an input and a textarea", async () => {
    const onInput = vi.fn();
    render(
      <>
        <Input aria-label="Name" onChange={onInput} />
        <Textarea aria-label="Notes" />
      </>
    );

    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Notes"), "hi");

    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Notes")).toHaveValue("hi");
    expect(onInput).toHaveBeenCalled();
  });

  it("selects an option and toggles a checkbox", async () => {
    const onChange = vi.fn();
    render(
      <>
        <Select aria-label="Priority" defaultValue="low">
          <option value="low">Low</option>
          <option value="high">High</option>
        </Select>
        <Checkbox label="Completed" onChange={onChange} />
      </>
    );

    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");

    await userEvent.click(screen.getByLabelText("Completed"));
    expect(screen.getByLabelText("Completed")).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
