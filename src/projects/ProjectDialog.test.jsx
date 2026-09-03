import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { ProjectDialog } from "./ProjectDialog";

const project = {
  id: "project-1",
  name: "Website launch",
  description: "Marketing site",
  color: "#1f9d64",
};

const mount = (overrides = {}) => {
  const runner = runtime.createRunner(ProjectDialog);
  runner.render({ open: true, onSubmit: vi.fn(), onClose: vi.fn(), ...overrides });
  return runner;
};

const formOf = (runner) => props(runner.output).children;
const bodyOf = (runner) => render(formOf(runner), 3);
const footerOf = (runner) => render(props(runner.output).footer, 3);

const nameInput = (runner) => find(bodyOf(runner), (node) => node.type === "input");
const descriptionInput = (runner) => find(bodyOf(runner), (node) => node.type === "textarea");
const swatches = (runner) => findAll(bodyOf(runner), (node) => props(node).role === "radio");
const buttons = (runner) => findAll(footerOf(runner), (node) => node.type === "button");
const submitButton = (runner) => buttons(runner).at(-1);

const submit = (runner) => formOf(runner).props.onSubmit({ preventDefault: vi.fn() });

describe("ProjectDialog create mode", () => {
  it("opens an empty small dialog titled New project", () => {
    const runner = mount();

    expect(props(runner.output).open).toBe(true);
    expect(props(runner.output).title).toBe("New project");
    expect(props(runner.output).size).toBe("sm");
    expect(props(nameInput(runner)).value).toBe("");
    expect(textContent(submitButton(runner))).toBe("Create project");
    expect(textContent(buttons(runner)[0])).toBe("Cancel");
  });

  it("requires a name before it submits", () => {
    const onSubmit = vi.fn();
    const runner = mount({ onSubmit });

    props(nameInput(runner)).onChange({ target: { value: "   " } });
    runner.render();
    submit(runner);
    runner.render();

    expect(onSubmit).not.toHaveBeenCalled();
    const error = find(bodyOf(runner), (node) => props(node).role === "alert");
    expect(textContent(error)).toBe("Enter a project name before saving.");
    expect(props(nameInput(runner))["aria-invalid"]).toBe(true);
  });

  it("submits the trimmed name, the description and the chosen color", () => {
    const onSubmit = vi.fn();
    const runner = mount({ onSubmit });

    props(nameInput(runner)).onChange({ target: { value: "  Phase 4  " } });
    runner.render();
    props(descriptionInput(runner)).onChange({ target: { value: "Ship the redesign" } });
    runner.render();
    props(swatches(runner)[2]).onClick();
    runner.render();
    submit(runner);

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Phase 4",
      description: "Ship the redesign",
      color: "#d5484a",
    });
  });

  it("offers eight colors as a radiogroup and checks the selected one", () => {
    const runner = mount();
    const group = find(bodyOf(runner), (node) => props(node).role === "radiogroup");
    const options = swatches(runner);

    expect(props(group)["aria-label"]).toBe("Project color");
    expect(options).toHaveLength(8);
    expect(options.map((node) => props(node)["aria-checked"])).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(props(options[0])["aria-label"]).toBe("Indigo");

    props(options[4]).onClick();
    runner.render();

    expect(props(swatches(runner)[4])["aria-checked"]).toBe(true);
    expect(props(swatches(runner)[0])["aria-checked"]).toBe(false);
  });

  it("counts the description against the 1000 character limit", () => {
    const runner = mount();

    expect(props(descriptionInput(runner)).maxLength).toBe(1000);
    expect(
      textContent(find(bodyOf(runner), (node) => props(node).className === "project-description-count"))
    ).toBe("0/1000");

    props(descriptionInput(runner)).onChange({ target: { value: "Five" } });
    runner.render();

    expect(
      textContent(find(bodyOf(runner), (node) => props(node).className === "project-description-count"))
    ).toBe("4/1000");
  });
});

describe("ProjectDialog edit mode", () => {
  it("prefills the project and renames the submit button", () => {
    const runner = mount({ project });

    expect(props(runner.output).title).toBe("Edit project");
    expect(props(nameInput(runner)).value).toBe("Website launch");
    expect(props(descriptionInput(runner)).value).toBe("Marketing site");
    expect(props(swatches(runner)[1])["aria-checked"]).toBe(true);
    expect(textContent(submitButton(runner))).toBe("Save");
  });

  it("re-seeds from the project each time it opens", () => {
    const runner = runtime.createRunner(ProjectDialog);
    runner.render({ open: false, onSubmit: vi.fn(), onClose: vi.fn() });
    runner.render({ open: true, project, onSubmit: vi.fn(), onClose: vi.fn() });
    runner.render();

    expect(props(nameInput(runner)).value).toBe("Website launch");
  });

  it("keeps a legacy color that is not in the palette", () => {
    const onSubmit = vi.fn();
    const runner = mount({ project: { ...project, color: "#6657c8" }, onSubmit });

    expect(swatches(runner).every((node) => props(node)["aria-checked"] === false)).toBe(true);

    submit(runner);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Website launch", color: "#6657c8" })
    );
  });
});

describe("ProjectDialog busy and error states", () => {
  it("disables every control while a save is in flight", () => {
    const onSubmit = vi.fn();
    const runner = mount({ busy: true, onSubmit });

    expect(props(runner.output).busy).toBe(true);
    expect(props(nameInput(runner)).disabled).toBe(true);
    expect(props(descriptionInput(runner)).disabled).toBe(true);
    expect(swatches(runner).every((node) => props(node).disabled)).toBe(true);
    expect(buttons(runner).every((node) => props(node).disabled)).toBe(true);

    submit(runner);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a save failure as an inline notice", () => {
    const runner = mount({ error: "We couldn't create this project." });
    const notice = find(bodyOf(runner), (node) => props(node).className?.includes("notice-error"));

    expect(textContent(notice)).toContain("We couldn't create this project.");
  });
});
