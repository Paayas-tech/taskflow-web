import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarAgendaView } from "./CalendarAgendaView";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarEvent } from "./CalendarEvent";
import { CalendarWeekView } from "./CalendarWeekView";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";

const todayKey = "2026-09-02";

const project = makeProject({ id: "project-1", name: "Launch", color: "#1f9d64" });

const shortDay = (year, month, day) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(
    new Date(year, month, day)
  );

const timedTask = makeTask({
  id: "task-standup",
  title: "Standup",
  dueDate: todayKey,
  startTime: "09:00",
  endTime: "09:30",
});

const multiDayTask = makeTask({
  id: "task-sprint",
  title: "Sprint review",
  dueDate: "2026-09-01",
  endDate: "2026-09-03",
});

let user;

beforeEach(() => {
  user = userEvent.setup();
});

describe("CalendarWeekView", () => {
  it("creates an all-day or one-hour task from an empty grid cell", async () => {
    await seedStore();
    const onCreateTask = vi.fn();
    renderPage(
      <CalendarWeekView
        tasks={[]}
        selectedDateKey={todayKey}
        todayKey={todayKey}
        onCreateTask={onCreateTask}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: `Add an all-day task on ${shortDay(2026, 8, 2)}`,
      })
    );
    expect(onCreateTask).toHaveBeenLastCalledWith({
      dueDate: todayKey,
      endDate: "",
      startTime: "",
      endTime: "",
    });

    await user.click(
      screen.getByRole("button", {
        name: `Add a one-hour task on ${shortDay(2026, 8, 2)} at 9:00 AM`,
      })
    );
    expect(onCreateTask).toHaveBeenLastCalledWith({
      dueDate: todayKey,
      endDate: "",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("puts a multi-day task in the all-day lane and draws the now line only on today", async () => {
    await seedStore();
    const { container, rerender } = renderPage(
      <CalendarWeekView
        tasks={[multiDayTask, timedTask]}
        selectedDateKey={todayKey}
        todayKey={todayKey}
        nowMinutes={540}
      />
    );

    expect(container.querySelectorAll(".cal-allday-events .cal-event")).toHaveLength(1);
    expect(container.querySelectorAll(".cal-week-columns .cal-event")).toHaveLength(1);
    expect(container.querySelectorAll(".cal-now-line")).toHaveLength(1);

    rerender(
      <CalendarWeekView
        tasks={[multiDayTask, timedTask]}
        selectedDateKey={todayKey}
        todayKey="2026-10-01"
        nowMinutes={540}
      />
    );
    expect(container.querySelectorAll(".cal-now-line")).toHaveLength(0);
  });
});

describe("CalendarDayView", () => {
  it("explains an empty all-day lane and opens a timed event", async () => {
    await seedStore();
    const onOpenTask = vi.fn();
    renderPage(
      <CalendarDayView
        tasks={[timedTask]}
        selectedDateKey={todayKey}
        todayKey={todayKey}
        onOpenTask={onOpenTask}
      />
    );

    expect(screen.getByText("No all-day tasks")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Open Standup\./ }));
    expect(onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-standup" })
    );
  });
});

describe("CalendarEvent", () => {
  it("tints a project chip, strikes completed work and marks Google events", async () => {
    await seedStore({ projects: [project] });
    const { container, rerender } = renderPage(
      <CalendarEvent
        task={{ ...timedTask, projectId: "project-1", completed: true, status: "completed" }}
      />
    );

    const chip = container.querySelector(".cal-chip");
    expect(chip).toHaveClass("is-complete");
    expect(chip.style.getPropertyValue("--cal-event-color")).toBe("#1f9d64");

    rerender(
      <CalendarEvent
        task={{
          id: "google:primary:evt-1",
          title: "Design sync",
          source: "google",
          dueDate: todayKey,
          startTime: "10:00",
          endTime: "11:00",
        }}
      />
    );

    const googleChip = container.querySelector(".cal-chip");
    expect(googleChip).toHaveClass("is-google");
    expect(googleChip).toHaveAccessibleName(/^Open Google Calendar event Design sync\./);
    expect(googleChip.textContent).toContain("G");
  });
});

describe("CalendarAgendaView", () => {
  it("splits the schedule into overdue, today and upcoming, dropping completed overdue work", async () => {
    await seedStore();
    renderPage(
      <CalendarAgendaView
        tasks={[
          makeTask({ id: "task-late", title: "Late invoice", dueDate: "2026-08-20" }),
          makeTask({
            id: "task-done",
            title: "Old chore",
            dueDate: "2026-08-21",
            completed: true,
            status: "completed",
          }),
          timedTask,
          makeTask({ id: "task-soon", title: "Ship release", dueDate: "2026-09-20" }),
        ]}
        todayKey={todayKey}
      />
    );

    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();
    expect(screen.getByText("Late invoice")).toBeInTheDocument();
    expect(screen.queryByText("Old chore")).not.toBeInTheDocument();
    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Ship release")).toBeInTheDocument();
  });
});
