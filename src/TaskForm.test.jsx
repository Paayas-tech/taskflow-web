import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultReminderAt,
  toDateTimeLocalValue,
} from "./domain/reminderDomain";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;
  let nextId = 0;

  return {
    activate(runner) {
      activeRunner = runner;
    },
    resetIds() {
      nextId = 0;
    },
    useId() {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { value: `task-form-${++nextId}` };
      return activeRunner.slots[index].value;
    },
    useState(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      const slot = activeRunner.slots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        },
      ];
    },
  };
});

const reminderService = vi.hoisted(() => ({
  requestNotificationPermission: vi.fn(),
}));

vi.mock("react", () => ({
  useId: hookRuntime.useId,
  useState: hookRuntime.useState,
}));
vi.mock("./services/reminderService", () => reminderService);

import TaskForm from "./TaskForm";

function childrenOf(node) {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
}

function resolveNode(node) {
  if (Array.isArray(node)) return node.map(resolveNode);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return resolveNode(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: childrenOf(node).map(resolveNode) },
  };
}

function walk(node, visitor) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visitor));
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  childrenOf(node).forEach((child) => walk(child, visitor));
}

function findElement(root, predicate) {
  let match;
  walk(root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function findElements(root, predicate) {
  const matches = [];
  walk(root, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
}

function baseValues(overrides = {}) {
  return {
    title: "Plan release",
    description: "",
    notes: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    reminder: false,
    reminderAt: "",
    listId: "",
    projectId: "",
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    values: baseValues(),
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    submitLabel: "Save Task",
    busyLabel: "Saving...",
    defaultReminderMinutes: 15,
    browserNotificationsEnabled: true,
    ...overrides,
  };
}

function createRunner(props) {
  const runner = { cursor: 0, slots: [], output: null };

  return {
    render(nextProps = props) {
      props = nextProps;
      runner.cursor = 0;
      hookRuntime.activate(runner);
      runner.output = resolveNode(TaskForm(props));
      return runner.output;
    },
    get output() {
      return runner.output;
    },
  };
}

const byName = (root, name) =>
  findElement(root, (node) => node.props?.name === name);
const reminderPreset = (root) =>
  findElement(
    root,
    (node) =>
      node.type === "select" &&
      childrenOf(node).some((child) => textContent(child) === "Custom date and time")
  );
const submitButton = (root) =>
  findElement(root, (node) => node.type === "button" && node.props?.type === "submit");

beforeEach(() => {
  hookRuntime.resetIds();
  reminderService.requestNotificationPermission.mockReset().mockResolvedValue("granted");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-23T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TaskForm reminder coordination", () => {
  it("offers authorized project members as assignees without exposing IDs", () => {
    const onChange = vi.fn();
    const memberId = "414b9bdb-dad5-467e-b361-8d3cb82eeac8";
    const runner = createRunner(baseProps({
      onChange,
      values: baseValues({ projectId: "project-a", assigneeId: "" }),
      projects: [{ id: "project-a", name: "Launch" }],
      projectMembers: [
        { userId: memberId, displayName: "Priya Shah", role: "editor" },
      ],
    }));
    runner.render();

    const assignee = byName(runner.output, "assigneeId");
    expect(textContent(assignee)).toContain("Priya Shah · editor");
    expect(textContent(assignee)).not.toContain(memberId);
    assignee.props.onChange({ target: { name: "assigneeId", value: memberId } });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "assigneeId", value: memberId },
    });
  });

  it("shows the existing reminder state and only reveals controls when enabled", () => {
    const disabledProps = baseProps();
    const runner = createRunner(disabledProps);
    runner.render();

    const checkbox = byName(runner.output, "reminder");
    expect(checkbox.props).toMatchObject({ type: "checkbox", checked: false });
    expect(textContent(runner.output)).toContain(
      "ReminderSchedule a browser or in-app notification."
    );
    expect(reminderPreset(runner.output)).toBeUndefined();

    const reminderAt = "2099-01-02T11:45";
    runner.render({
      ...disabledProps,
      values: baseValues({ reminder: true, reminderAt }),
    });
    expect(byName(runner.output, "reminder").props.checked).toBe(true);
    expect(reminderPreset(runner.output)).toBeDefined();
    expect(byName(runner.output, "reminderAt").props.value).toBe(reminderAt);
  });

  it.each([true, false])(
    "enables a reminder with its default while browser notifications are %s",
    (browserNotificationsEnabled) => {
      const onChange = vi.fn();
      const props = baseProps({
        onChange,
        defaultReminderMinutes: 30,
        browserNotificationsEnabled,
      });
      const runner = createRunner(props);
      runner.render();

      byName(runner.output, "reminder").props.onChange({ target: { checked: true } });

      const expectedReminderAt = toDateTimeLocalValue(
        defaultReminderAt(
          props.values,
          new Date("2026-08-23T10:00:00.000Z"),
          30
        )
      );
      expect(onChange).toHaveBeenNthCalledWith(1, {
        target: {
          name: "reminder",
          value: true,
          type: "checkbox",
          checked: true,
        },
      });
      expect(onChange).toHaveBeenNthCalledWith(2, {
        target: {
          name: "reminderAt",
          value: expectedReminderAt,
          type: "text",
          checked: false,
        },
      });
      expect(reminderService.requestNotificationPermission).toHaveBeenCalledTimes(
        browserNotificationsEnabled ? 1 : 0
      );
    }
  );

  it("disables a reminder, clears its time, and restores the custom preset", () => {
    const onChange = vi.fn();
    const values = baseValues({
      reminder: true,
      reminderAt: "2099-01-02T11:45",
      dueDate: "2099-01-02",
      startTime: "12:00",
    });
    const props = baseProps({ values, onChange });
    const runner = createRunner(props);
    runner.render();
    reminderPreset(runner.output).props.onChange({ target: { value: "15-minutes" } });
    runner.render();
    expect(reminderPreset(runner.output).props.value).toBe("15-minutes");

    byName(runner.output, "reminder").props.onChange({ target: { checked: false } });
    expect(onChange).toHaveBeenLastCalledWith({
      target: { name: "reminderAt", value: "", type: "text", checked: false },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "reminder",
        value: false,
        type: "checkbox",
        checked: false,
      },
    });

    runner.render();
    expect(reminderPreset(runner.output).props.value).toBe("custom");
  });

  it("clears reminder values and any preset-specific error", () => {
    const onChange = vi.fn();
    const props = baseProps({
      values: baseValues({ reminder: true, reminderAt: "" }),
      onChange,
    });
    const runner = createRunner(props);
    runner.render();
    reminderPreset(runner.output).props.onChange({ target: { value: "15-minutes" } });
    runner.render();
    expect(textContent(runner.output)).toContain(
      "Choose a future task date and time before using this preset."
    );

    const clear = findElement(
      runner.output,
      (node) => node.type === "button" && textContent(node) === "Clear reminder"
    );
    clear.props.onClick();
    runner.render();

    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "reminder",
        value: false,
        type: "checkbox",
        checked: false,
      },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "reminderAt", value: "", type: "text", checked: false },
    });
    expect(reminderPreset(runner.output).props.value).toBe("custom");
    expect(textContent(runner.output)).not.toContain(
      "Choose a future task date and time before using this preset."
    );
  });

  it("calculates and preserves a valid reminder preset", () => {
    const onChange = vi.fn();
    const props = baseProps({
      values: baseValues({
        reminder: true,
        reminderAt: "2099-01-02T11:45",
        dueDate: "2099-01-02",
        startTime: "12:00",
      }),
      onChange,
    });
    const runner = createRunner(props);
    runner.render();

    reminderPreset(runner.output).props.onChange({ target: { value: "15-minutes" } });
    runner.render();

    expect(reminderPreset(runner.output).props.value).toBe("15-minutes");
    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "reminderAt",
        value: "2099-01-02T11:45",
        type: "text",
        checked: false,
      },
    });
  });

  it("shows the preset error without emitting a reminder time when unscheduled", () => {
    const onChange = vi.fn();
    const props = baseProps({
      values: baseValues({ reminder: true, reminderAt: "" }),
      onChange,
    });
    const runner = createRunner(props);
    runner.render();

    reminderPreset(runner.output).props.onChange({ target: { value: "1-hour" } });
    runner.render();

    expect(textContent(runner.output)).toContain(
      "Choose a future task date and time before using this preset."
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards manual time edits and returns the preset to custom", () => {
    const onChange = vi.fn();
    const props = baseProps({
      values: baseValues({ reminder: true, reminderAt: "" }),
      onChange,
    });
    const runner = createRunner(props);
    runner.render();
    reminderPreset(runner.output).props.onChange({ target: { value: "1-hour" } });
    runner.render();
    expect(textContent(runner.output)).toContain(
      "Choose a future task date and time before using this preset."
    );

    const event = {
      target: { name: "reminderAt", value: "2099-01-02T11:00" },
    };
    byName(runner.output, "reminderAt").props.onChange(event);
    runner.render();

    expect(onChange).toHaveBeenCalledWith(event);
    expect(reminderPreset(runner.output).props.value).toBe("custom");
    expect(textContent(runner.output)).not.toContain(
      "Choose a future task date and time before using this preset."
    );
  });

  it("blocks submission and disables save for an invalid reminder", () => {
    const onSubmit = vi.fn();
    const props = baseProps({
      values: baseValues({ reminder: true, reminderAt: "invalid" }),
      onSubmit,
    });
    const runner = createRunner(props);
    runner.render();

    expect(textContent(runner.output)).toContain("Choose a valid reminder date and time.");
    expect(submitButton(runner.output).props.disabled).toBe(true);
    const event = { preventDefault: vi.fn() };
    findElement(runner.output, (node) => node.type === "form").props.onSubmit(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards a valid submission event unchanged", () => {
    const onSubmit = vi.fn();
    const runner = createRunner(baseProps({ onSubmit }));
    runner.render();
    const event = { preventDefault: vi.fn() };

    findElement(runner.output, (node) => node.type === "form").props.onSubmit(event);

    expect(onSubmit).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(submitButton(runner.output).props.disabled).toBe(false);
  });

  it("keeps reminder controls and actions disabled while busy", () => {
    const runner = createRunner(
      baseProps({
        values: baseValues({ reminder: true, reminderAt: "2099-01-02T11:45" }),
        busy: true,
      })
    );
    runner.render();

    expect(byName(runner.output, "reminder").props.disabled).toBe(true);
    expect(reminderPreset(runner.output).props.disabled).toBe(true);
    expect(byName(runner.output, "reminderAt").props.disabled).toBe(true);
    expect(
      findElements(runner.output, (node) => node.type === "button").every(
        (button) => button.props.disabled === true
      )
    ).toBe(true);
  });
});
