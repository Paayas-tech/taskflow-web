import { describe, expect, it, vi } from "vitest";
import { find, findAll, props, render, textContent } from "../test/elementTree";
import ProjectRemindersPanel from "./ProjectRemindersPanel";

const renderPanel = (overrides = {}) =>
  render(
    ProjectRemindersPanel({
      reminder: {
        defaultTime: 30,
        enableInAppReminders: true,
        enableSound: false,
      },
      onDefaultTimeChange: vi.fn(),
      onDefaultTimeCommit: vi.fn(),
      onInAppRemindersChange: vi.fn(),
      onSoundChange: vi.fn(),
      ...overrides,
    }),
    8
  );

describe("ProjectRemindersPanel", () => {
  it("names the panel and says that changes save themselves", () => {
    const output = renderPanel();

    expect(props(output)["aria-label"]).toBe("Project reminders");
    expect(textContent(output)).toContain("Set reminder timing and delivery.");
    expect(textContent(output)).toContain("Changes save automatically.");
  });

  it("keeps the offset a draft while typing and saves it on blur", () => {
    const onDefaultTimeChange = vi.fn();
    const onDefaultTimeCommit = vi.fn();
    const output = renderPanel({ onDefaultTimeChange, onDefaultTimeCommit });
    const input = find(output, (node) => props(node).type === "number");
    const label = find(output, (node) => props(node).className === "field-label");

    expect(textContent(label)).toBe("Remind me");
    expect(props(label).htmlFor).toBe(props(input).id);
    expect(props(input)).toMatchObject({ min: "1", max: "1440", value: 30 });
    props(input).onChange({ target: { value: "45" } });
    expect(onDefaultTimeChange).toHaveBeenCalledWith(45);
    expect(onDefaultTimeCommit).not.toHaveBeenCalled();
    props(input).onBlur({ target: { value: "45" } });
    expect(onDefaultTimeCommit).toHaveBeenCalledWith(45);
  });

  it("preserves both delivery toggles, their copy, and their callbacks", () => {
    const onInAppRemindersChange = vi.fn();
    const onSoundChange = vi.fn();
    const output = renderPanel({ onInAppRemindersChange, onSoundChange });
    const toggles = findAll(output, (node) => props(node).type === "checkbox");

    expect(textContent(output)).toContain("In-app reminders");
    expect(textContent(output)).toContain("Show alerts in TaskFlow.");
    expect(textContent(output)).toContain("Reminder sound");
    expect(textContent(output)).toContain("Play a sound for alerts.");
    expect(toggles.map((toggle) => props(toggle)["aria-label"])).toEqual([
      "In-app reminders",
      "Reminder sound",
    ]);
    expect(toggles.map((toggle) => props(toggle).checked)).toEqual([true, false]);

    props(toggles[0]).onChange({ target: { checked: false } });
    props(toggles[1]).onChange({ target: { checked: true } });
    expect(onInAppRemindersChange).toHaveBeenCalledWith(false);
    expect(onSoundChange).toHaveBeenCalledWith(true);
  });
});
