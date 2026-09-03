import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);
vi.mock("../tasks", () => ({
  TaskRow: function TaskRow() {
    return null;
  },
}));

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { TaskRow } from "../tasks";
import CalendarAgendaView from "./CalendarAgendaView";
import CalendarDayView from "./CalendarDayView";
import CalendarEvent from "./CalendarEvent";
import CalendarWeekView from "./CalendarWeekView";

const todayKey = "2026-09-02";
const projectsById = new Map([["project-1", { id: "project-1", name: "Launch", color: "#1f9d64" }]]);
const formatSettings = { format: "24-hour", dateFormat: "YYYY-MM-DD" };

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

const googleEvent = task("google:primary:evt-1", "Design sync", {
  source: "google",
  startTime: "10:00",
  endTime: "11:00",
  htmlLink: "https://calendar.google.com/event",
});

const classList = (node) => String(props(node).className || "").split(" ");

describe("CalendarEvent", () => {
  it("renders a month chip tinted by the project color", () => {
    const chip = CalendarEvent({
      task: task("t1", "Write spec", { projectId: "project-1" }),
      projectsById,
      formatSettings,
    });

    expect(classList(chip)).toContain("cal-chip");
    expect(classList(chip)).toContain("cal-ev-allday");
    expect(chip.props.style["--cal-event-color"]).toBe("#1f9d64");
    expect(textContent(chip)).toContain("Write spec");
    expect(props(chip)["aria-label"]).toContain("Open Write spec");
  });

  it("falls back to the accent for personal tasks and strikes completed ones", () => {
    const chip = CalendarEvent({
      task: task("t1", "Write spec", { status: "completed", completed: true }),
      formatSettings,
    });

    expect(chip.props.style["--cal-event-color"]).toBe("var(--color-accent)");
    expect(classList(chip)).toContain("is-complete");
  });

  it("prefixes Google events with G and marks them read-only in the label", () => {
    const chip = CalendarEvent({ task: googleEvent, projectsById, formatSettings });

    expect(classList(chip)).toContain("is-google");
    expect(chip.props.style["--cal-event-color"]).toBe("var(--color-info)");
    expect(textContent(chip)).toContain("G");
    expect(props(chip)["aria-label"]).toContain("Open Google Calendar event Design sync");
  });

  it("becomes an absolutely positioned block in the time grids", () => {
    const block = CalendarEvent({
      task: task("t2", "Standup", { startTime: "09:00", endTime: "09:30" }),
      viewContext: "week",
      selected: true,
      formatSettings,
    });

    expect(classList(block)).toContain("cal-event");
    expect(classList(block)).toContain("cal-ev-timed");
    expect(classList(block)).toContain("is-selected");
    expect(textContent(block)).toContain("09:00");
  });

  it("stops a chip click from reaching the day cell behind it", () => {
    const onClick = vi.fn();
    const chip = CalendarEvent({ task: task("t1", "Write spec"), onClick, formatSettings });
    const stopPropagation = vi.fn();

    props(chip).onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("CalendarWeekView", () => {
  const weekProps = (overrides = {}) => ({
    tasks: [
      task("t1", "Standup", { dueDate: "2026-09-02", startTime: "09:00", endTime: "09:30" }),
      task("t2", "Sprint", { dueDate: "2026-09-01", endDate: "2026-09-04" }),
    ],
    selectedDateKey: todayKey,
    todayKey,
    nowMinutes: 630,
    onSelectDate: vi.fn(),
    onCreateTask: vi.fn(),
    onOpenTask: vi.fn(),
    projectsById,
    weekStartsOn: 0,
    formatSettings,
    ...overrides,
  });

  it("renders seven day headings and marks today and the selected day", () => {
    const tree = CalendarWeekView(weekProps());
    const headings = findAll(tree, (node) => classList(node).includes("cal-week-heading"));

    expect(headings).toHaveLength(7);
    expect(classList(headings[3])).toEqual(
      expect.arrayContaining(["cal-week-heading", "is-selected", "is-today"])
    );
  });

  it("keeps the multi-day item in the all-day lane with its grid span", () => {
    const tree = CalendarWeekView(weekProps());
    const lane = find(tree, (node) => props(node).className === "cal-allday-events");
    const segment = find(lane, (node) => node.type === CalendarEvent);

    expect(props(segment).task.title).toBe("Sprint");
    expect(props(segment).style.gridColumn).toBe("3 / 7");
  });

  it("creates all-day and one-hour tasks from the empty grid", () => {
    const viewProps = weekProps();
    const tree = CalendarWeekView(viewProps);
    const cells = findAll(tree, (node) => props(node).className === "cal-allday-cell");
    const slots = findAll(tree, (node) => props(node).className === "cal-slot");

    props(cells[2]).onClick();
    expect(viewProps.onSelectDate).toHaveBeenCalledWith("2026-09-01");
    expect(viewProps.onCreateTask).toHaveBeenCalledWith({
      dueDate: "2026-09-01",
      endDate: "",
      startTime: "",
      endTime: "",
    });

    props(slots[9]).onClick();
    expect(viewProps.onCreateTask).toHaveBeenLastCalledWith({
      dueDate: "2026-08-30",
      endDate: "",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("draws the now line only in today's column", () => {
    const columns = findAll(
      CalendarWeekView(weekProps()),
      (node) => props(node).className === "cal-day-column"
    );

    expect(findAll(columns[3], (node) => props(node).className === "cal-now-line")).toHaveLength(1);
    expect(findAll(columns[0], (node) => props(node).className === "cal-now-line")).toHaveLength(0);
  });

  it("opens a timed event through onOpenTask", () => {
    const viewProps = weekProps();
    const tree = CalendarWeekView(viewProps);
    const columns = findAll(tree, (node) => props(node).className === "cal-day-column");
    const event = find(columns[3], (node) => node.type === CalendarEvent);

    props(event).onClick({ currentTarget: "event-element" });
    expect(viewProps.onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "event-element"
    );
  });
});

describe("CalendarDayView", () => {
  const dayProps = (overrides = {}) => ({
    tasks: [
      task("t1", "Standup", { startTime: "09:00", endTime: "09:30" }),
      task("t2", "Offsite", { dueDate: "2026-09-01", endDate: "2026-09-03" }),
    ],
    selectedDateKey: todayKey,
    todayKey,
    nowMinutes: 630,
    onCreateTask: vi.fn(),
    onOpenTask: vi.fn(),
    projectsById,
    formatSettings,
    ...overrides,
  });

  it("shows the all-day lane, the timed events and the now line", () => {
    const tree = CalendarDayView(dayProps());
    const allDay = find(tree, (node) => props(node).className === "cal-day-allday-events");

    expect(props(find(allDay, (node) => node.type === CalendarEvent)).task.title).toBe("Offsite");
    expect(find(tree, (node) => props(node).className === "cal-now-line")).toBeDefined();
    expect(
      findAll(find(tree, (node) => props(node).className === "cal-day-column"), (node) =>
        node.type === CalendarEvent
      ).map((node) => props(node).task.id)
    ).toEqual(["t1"]);
  });

  it("explains an empty all-day lane and hides the now line on other days", () => {
    const tree = CalendarDayView(dayProps({ tasks: [], selectedDateKey: "2026-09-05" }));

    expect(textContent(find(tree, (node) => props(node).className?.includes("cal-allday-empty")))).toBe(
      "No all-day tasks"
    );
    expect(find(tree, (node) => props(node).className === "cal-now-line")).toBeUndefined();
  });

  it("creates timed tasks from an hour slot on the shown day", () => {
    const viewProps = dayProps();
    const slots = findAll(CalendarDayView(viewProps), (node) => props(node).className === "cal-slot");

    props(slots[14]).onClick();
    expect(viewProps.onCreateTask).toHaveBeenCalledWith({
      dueDate: todayKey,
      endDate: "",
      startTime: "14:00",
      endTime: "15:00",
    });
  });
});

describe("CalendarAgendaView", () => {
  const agendaProps = (overrides = {}) => ({
    tasks: [
      task("t1", "Overdue thing", { dueDate: "2026-08-28" }),
      task("t2", "Write spec", { dueDate: todayKey, projectId: "project-1" }),
      googleEvent,
      task("t4", "Later thing", { dueDate: "2026-09-20" }),
    ],
    todayKey,
    selectedTaskId: "t2",
    projectsById,
    pendingIds: new Set(["t2"]),
    onSelectDate: vi.fn(),
    onToggleComplete: vi.fn(),
    onOpenTask: vi.fn(),
    formatSettings,
    ...overrides,
  });

  it("groups the schedule into overdue, today and upcoming dense rows", () => {
    const tree = CalendarAgendaView(agendaProps());
    const titles = findAll(tree, (node) => props(node).className === "section-title").map(
      (node) => textContent(node)
    );
    const rows = findAll(tree, (node) => node.type === TaskRow);

    expect(titles).toEqual(["Overdue", "Today", "Upcoming"]);
    expect(rows.every((row) => props(row).dense === true)).toBe(true);
    expect(rows.map((row) => props(row).task.id)).toEqual([
      "t1",
      "t2",
      googleEvent.id,
      "t4",
    ]);
  });

  it("marks the open task, the pending one and keeps Google rows read-only", () => {
    const tree = CalendarAgendaView(agendaProps());
    const rows = findAll(tree, (node) => node.type === TaskRow);
    const [, today, google] = rows;

    expect(props(today).selected).toBe(true);
    expect(props(today).busy).toBe(true);
    expect(props(today).context.projectsById.get("project-1").name).toBe("Launch");
    expect(props(google).readOnly).toBe(true);
    expect(props(google).onToggleComplete).toBeUndefined();
  });

  it("shows the schedule time beside each row and selects a date group", () => {
    const viewProps = agendaProps();
    const tree = CalendarAgendaView(viewProps);
    const times = findAll(tree, (node) =>
      String(props(node).className || "").startsWith("cal-agenda-time")
    ).map((node) => textContent(node));

    expect(times).toContain("All day");
    expect(times).toContain("10:00–11:00");

    props(find(tree, (node) => props(node).className === "cal-agenda-date")).onClick();
    expect(viewProps.onSelectDate).toHaveBeenCalledWith("2026-08-28");
  });

  it("hides completed work from the overdue section", () => {
    const tree = CalendarAgendaView(
      agendaProps({
        tasks: [
          task("t1", "Done already", {
            dueDate: "2026-08-28",
            status: "completed",
            completed: true,
          }),
          task("t2", "Write spec", { dueDate: todayKey }),
        ],
      })
    );

    expect(textContent(tree)).not.toContain("Overdue");
  });

  it("explains an empty agenda with the next step", () => {
    const tree = render(CalendarAgendaView(agendaProps({ tasks: [] })));

    expect(textContent(tree)).toContain("Nothing scheduled");
  });
});
