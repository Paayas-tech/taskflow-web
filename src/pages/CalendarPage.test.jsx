import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);
vi.mock("../tasks", () => ({
  QuickAdd: function QuickAdd() {
    return null;
  },
  TaskRow: function TaskRow() {
    return null;
  },
}));

import { find, findAll, findByText, props, textContent } from "../test/elementTree";
import { QuickAdd, TaskRow } from "../tasks";
import CalendarAgendaView from "../calendar/CalendarAgendaView";
import CalendarDayView from "../calendar/CalendarDayView";
import CalendarEvent from "../calendar/CalendarEvent";
import CalendarWeekView from "../calendar/CalendarWeekView";
import CalendarPage from "./CalendarPage";

const todayKey = "2026-09-02";
const busyKey = "2026-09-10";

const fullDate = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const task = (id, title, overrides = {}) => ({
  id,
  title,
  description: "",
  status: "todo",
  completed: false,
  priority: "medium",
  projectId: null,
  archivedAt: null,
  dueDate: todayKey,
  ...overrides,
});

const baseTasks = [
  task("t1", "Write spec", { projectId: "project-1" }),
  task("t2", "Retro", { dueDate: busyKey }),
  task("t3", "Review PR", { dueDate: busyKey }),
  task("t4", "Ship release", { dueDate: busyKey }),
  task("t5", "Write docs", { dueDate: busyKey }),
  task("t6", "Sprint", { dueDate: "2026-09-14", endDate: "2026-09-16" }),
  task("t7", "Standup", { dueDate: "2026-09-03", startTime: "09:00", endTime: "09:30" }),
];

const externalEvents = [
  {
    id: "evt-1",
    calendarId: "primary",
    title: "Design sync",
    start: "2026-09-10T10:00:00",
    end: "2026-09-10T11:00:00",
    htmlLink: "https://calendar.google.com/event",
  },
];

const createProps = (overrides = {}) => ({
  userId: "user-1",
  tasks: baseTasks,
  externalEvents,
  tasksLoading: false,
  tasksError: "",
  onRetry: vi.fn(),
  taskActions: {
    pendingIds: new Set(),
    toggleComplete: vi.fn().mockResolvedValue(undefined),
    createPersonal: vi.fn().mockResolvedValue({ id: "new-task" }),
  },
  onOpenTask: vi.fn(),
  selectedTaskId: null,
  onNewTask: vi.fn(),
  formatSettings: { format: "24-hour", dateFormat: "YYYY-MM-DD" },
  weekStartsOn: 0,
  projects: [{ id: "project-1", name: "Launch", color: "#5b5bd6" }],
  ...overrides,
});

const viewControl = (tree) => find(tree, (node) => props(node).ariaLabel === "Calendar view");
const byLabel = (tree, label) =>
  find(tree, (node) => (props(node)["aria-label"] ?? props(node).label) === label);
const rangeLabel = (tree) =>
  textContent(find(tree, (node) => props(node).className === "cal-range"));
const agendaTitle = (tree) =>
  textContent(find(tree, (node) => props(node).className === "cal-agenda-title"));
const cellSelect = (tree, dateKey) =>
  find(
    tree,
    (node) =>
      props(node).className === "cal-cell-select" &&
      String(props(node)["aria-label"]).startsWith(fullDate(dateKey))
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 2, 10, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarPage views", () => {
  it("offers the four views and swaps the body when one is chosen", () => {
    const runner = runtime.createRunner(CalendarPage);
    const tree = runner.render(createProps());
    const control = viewControl(tree);

    expect(props(control).options.map((option) => option.id)).toEqual([
      "month",
      "week",
      "day",
      "agenda",
    ]);
    expect(props(control).value).toBe("month");
    expect(find(tree, (node) => props(node).className === "cal-grid")).toBeDefined();

    props(control).onChange("week");
    const week = runner.render();
    expect(find(week, (node) => node.type === CalendarWeekView)).toBeDefined();
    expect(find(week, (node) => props(node).className === "cal-grid")).toBeUndefined();

    props(viewControl(week)).onChange("day");
    expect(find(runner.render(), (node) => node.type === CalendarDayView)).toBeDefined();

    props(viewControl(runner.output)).onChange("agenda");
    const agenda = runner.render();
    expect(find(agenda, (node) => node.type === CalendarAgendaView)).toBeDefined();
    expect(rangeLabel(agenda)).toBe("Agenda");
    expect(byLabel(agenda, "Previous month")).toBeUndefined();
  });

  it("hands the week and day grids the schedule, today marker and create handler", () => {
    const pageProps = createProps();
    const runner = runtime.createRunner(CalendarPage);
    props(viewControl(runner.render(pageProps))).onChange("week");
    const week = find(runner.render(), (node) => node.type === CalendarWeekView);

    expect(props(week).todayKey).toBe(todayKey);
    expect(props(week).nowMinutes).toBe(630);
    expect(props(week).onCreateTask).toBe(pageProps.onNewTask);
    expect(props(week).selectedDateKey).toBe(todayKey);
    expect(props(week).tasks.map((item) => item.id)).toContain("t7");
    expect(props(week).projectsById.get("project-1").name).toBe("Launch");
  });
});

describe("CalendarPage navigation", () => {
  it("moves through months and returns to today", () => {
    const runner = runtime.createRunner(CalendarPage);
    const tree = runner.render(createProps());

    expect(rangeLabel(tree)).toBe("September 2026");

    props(byLabel(tree, "Next month")).onClick();
    expect(rangeLabel(runner.render())).toBe("October 2026");

    props(byLabel(runner.output, "Previous month")).onClick();
    props(byLabel(runner.render(), "Previous month")).onClick();
    expect(rangeLabel(runner.render())).toBe("August 2026");

    props(findByText(runner.output, "Today")).onClick();
    const back = runner.render();
    expect(rangeLabel(back)).toBe("September 2026");
    expect(agendaTitle(back)).toBe(fullDate(todayKey));
  });

  it("steps a week at a time in week view", () => {
    const runner = runtime.createRunner(CalendarPage);
    props(viewControl(runner.render(createProps()))).onChange("week");
    const week = runner.render();
    const firstRange = rangeLabel(week);

    expect(byLabel(week, "Next week")).toBeDefined();
    props(byLabel(week, "Next week")).onClick();
    const next = runner.render();

    expect(rangeLabel(next)).not.toBe(firstRange);
    expect(props(find(next, (node) => node.type === CalendarWeekView)).selectedDateKey).toBe(
      "2026-09-09"
    );
  });
});

describe("CalendarPage month grid", () => {
  it("selects a day from the cell and from the +N more link", () => {
    const runner = runtime.createRunner(CalendarPage);
    const tree = runner.render(createProps());

    expect(agendaTitle(tree)).toBe(fullDate(todayKey));

    const more = find(tree, (node) => props(node).className === "cal-more");
    expect(textContent(more)).toBe("+2 more");
    expect(props(more)["aria-label"]).toBe(`Show 2 more on ${fullDate(busyKey)}`);

    more.props.onClick({ stopPropagation: vi.fn() });
    const busy = runner.render();
    expect(agendaTitle(busy)).toBe(fullDate(busyKey));
    expect(
      textContent(
        find(busy, (node) =>
          String(props(node).className || "").startsWith("cal-agenda-count")
        )
      )
    ).toBe("5 tasks");

    props(cellSelect(busy, "2026-09-04")).onClick();
    expect(agendaTitle(runner.render())).toBe(fullDate("2026-09-04"));
  });

  it("keeps multi-day items on their own lane in the week row", () => {
    const runner = runtime.createRunner(CalendarPage);
    const layer = find(
      runner.render(createProps()),
      (node) => props(node).className === "cal-multiday"
    );
    const segment = find(layer, (node) => node.type === CalendarEvent);

    expect(props(segment).segment).toMatchObject({
      rowKey: "2026-09-13",
      startColumn: 1,
      endColumn: 3,
      lane: 0,
    });
    expect(props(segment).style.gridColumn).toBe("2 / 5");
    expect(props(segment).style.gridRow).toBe(1);
  });

  it("opens a task from a month chip and marks the selected one", () => {
    const pageProps = createProps({ selectedTaskId: "t1" });
    const runner = runtime.createRunner(CalendarPage);
    const chip = findAll(runner.render(pageProps), (node) => node.type === CalendarEvent).find(
      (node) => props(node).task.id === "t1"
    );

    expect(props(chip).selected).toBe(true);
    props(chip).onClick({ currentTarget: "chip-element" });
    expect(pageProps.onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "chip-element"
    );
  });
});

describe("CalendarPage day agenda", () => {
  it("creates a personal task on the selected date and hands the title to the composer", async () => {
    const pageProps = createProps();
    const runner = runtime.createRunner(CalendarPage);
    const quickAdd = find(runner.render(pageProps), (node) => node.type === QuickAdd);

    await props(quickAdd).onCreate("Draft agenda");
    expect(pageProps.taskActions.createPersonal).toHaveBeenCalledWith({
      title: "Draft agenda",
      dueDate: todayKey,
    });

    props(quickAdd).onOpenDetails("Draft agenda");
    expect(pageProps.onNewTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Draft agenda", dueDate: todayKey })
    );
  });

  it("seeds New task with the selected date", () => {
    const pageProps = createProps();
    const runner = runtime.createRunner(CalendarPage);
    const tree = runner.render(pageProps);

    props(cellSelect(tree, busyKey)).onClick();
    props(findByText(runner.render(), "New task")).onClick();

    expect(pageProps.onNewTask).toHaveBeenCalledWith({
      dueDate: busyKey,
      endDate: "",
      startTime: "",
      endTime: "",
    });
  });

  it("lists the day as dense rows wired to open and complete", async () => {
    const pageProps = createProps();
    const runner = runtime.createRunner(CalendarPage);
    const row = find(runner.render(pageProps), (node) => node.type === TaskRow);

    expect(props(row).dense).toBe(true);
    expect(props(row).todayKey).toBe(todayKey);
    expect(props(row).context.projectsById.get("project-1").name).toBe("Launch");

    props(row).onOpen(props(row).task, "row-element");
    expect(pageProps.onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "row-element"
    );

    await props(row).onToggleComplete(props(row).task);
    expect(pageProps.taskActions.toggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" })
    );
  });

  it("renders Google events as read-only rows that open the source event", () => {
    const openSpy = vi.fn();
    globalThis.window = { open: openSpy };
    const pageProps = createProps();
    const runner = runtime.createRunner(CalendarPage);

    props(cellSelect(runner.render(pageProps), busyKey)).onClick();
    const rows = findAll(runner.render(), (node) => node.type === TaskRow);
    const googleRow = rows.find((node) => props(node).task.source === "google");

    expect(props(googleRow).task.title).toBe("Design sync");
    expect(props(googleRow).readOnly).toBe(true);
    expect(props(googleRow).onToggleComplete).toBeUndefined();

    props(googleRow).onOpen(props(googleRow).task, null);
    expect(openSpy).toHaveBeenCalledWith(
      "https://calendar.google.com/event",
      "_blank",
      "noopener,noreferrer"
    );
    expect(pageProps.onOpenTask).not.toHaveBeenCalled();
    delete globalThis.window;
  });

  it("reports a failed completion without losing the day", async () => {
    const pageProps = createProps();
    pageProps.taskActions.toggleComplete.mockRejectedValue(new Error("offline"));
    const runner = runtime.createRunner(CalendarPage);
    const row = find(runner.render(pageProps), (node) => node.type === TaskRow);

    await props(row).onToggleComplete(props(row).task);
    const failed = runner.render();
    const notice = find(failed, (node) => props(node).className === "page-notice");

    expect(props(notice).tone).toBe("error");
    expect(textContent(notice)).toContain("Write spec");

    props(notice).onDismiss();
    expect(
      find(runner.render(), (node) => props(node).className === "page-notice")
    ).toBeUndefined();
  });
});

describe("CalendarPage loading and errors", () => {
  it("shows skeletons instead of the grid while tasks load", () => {
    const tree = runtime
      .createRunner(CalendarPage)
      .render(createProps({ tasksLoading: true }));

    expect(props(find(tree, (node) => props(node).role === "status"))["aria-label"]).toBe(
      "Loading calendar"
    );
    expect(find(tree, (node) => props(node).className === "cal-grid")).toBeUndefined();
    expect(viewControl(tree)).toBeDefined();
  });

  it("offers a retry when the task load failed", () => {
    const pageProps = createProps({ tasksError: "We couldn't load your tasks." });
    const tree = runtime.createRunner(CalendarPage).render(pageProps);
    const notice = find(tree, (node) => props(node).className === "page-notice");

    expect(textContent(notice)).toContain("We couldn't load your tasks.");
    props(findByText(props(notice).action, "Try again")).onClick();
    expect(pageProps.onRetry).toHaveBeenCalledOnce();
  });
});
