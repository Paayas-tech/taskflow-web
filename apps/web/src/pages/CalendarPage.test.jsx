import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./CalendarPage";
import { makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { loadTasks } from "../store/session";
import { getState } from "../store/store";
import { GOOGLE_EVENTS_STALE_MS } from "../store/calendar";

/** 2026-09-02 is a Wednesday; the calendar reads "today" from the clock. */
const TODAY = new Date(2026, 8, 2, 9, 0, 0);

const fullDate = (year, month, day) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month, day));

const monthLabel = (year, month) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );

const brief = makeTask({
  id: "task-brief",
  title: "Write the brief",
  dueDate: "2026-09-15",
});

const googleEvent = {
  id: "evt-1",
  calendarId: "primary",
  title: "Design sync",
  start: "2026-09-02T10:00:00",
  end: "2026-09-02T11:00:00",
  htmlLink: "https://calendar.google.com/event?eid=1",
};

let user;

const renderCalendar = async () => {
  const view = renderPage(<CalendarPage />);
  await waitFor(() => expect(getState().loaded.googleEvents).not.toBe("loading"));
  return view;
};

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TODAY);
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows a task in the month grid on its due date", async () => {
    await seedStore({ tasks: [brief] });
    await renderCalendar();

    expect(
      screen.getByRole("button", { name: /^Open Write the brief\./ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${fullDate(2026, 8, 15)}, 1 task` })
    ).toBeInTheDocument();
  });

  it("swaps the body between the month, week, day and agenda views", async () => {
    await seedStore({ tasks: [brief] });
    await renderCalendar();

    expect(screen.getByRole("grid", { name: monthLabel(2026, 8) })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("region", { name: "Week view" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByRole("region", { name: "Day view" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next / })).not.toBeInTheDocument();
  });

  it("steps through months and jumps back to today", async () => {
    await seedStore({ tasks: [brief] });
    await renderCalendar();

    expect(screen.getByText(monthLabel(2026, 8))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText(monthLabel(2026, 9))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText(monthLabel(2026, 7))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText(monthLabel(2026, 8))).toBeInTheDocument();
  });

  it("selects a day cell and opens the composer seeded with that date", async () => {
    await seedStore({ tasks: [brief] });
    await renderCalendar();

    await user.click(
      screen.getByRole("button", { name: `${fullDate(2026, 8, 15)}, 1 task` })
    );
    expect(
      screen.getByRole("heading", { name: fullDate(2026, 8, 15) })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New task" }));

    expect(getState().ui.composer.open).toBe(true);
    expect(getState().ui.composer.initialValues).toMatchObject({
      dueDate: "2026-09-15",
      startTime: "",
      endTime: "",
    });
  });

  it("opens a task from its month chip", async () => {
    await seedStore({ tasks: [brief] });
    await renderCalendar();

    await user.click(screen.getByRole("button", { name: /^Open Write the brief\./ }));

    expect(getState().ui.selectedTaskId).toBe("task-brief");
  });

  it("keeps Google Calendar events read-only and opens them in Google", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await seedStore({
      googleConnection: { email: "sam@example.com" },
      googleEvents: [googleEvent],
    });
    await renderCalendar();

    await user.click(
      await screen.findByRole("button", {
        name: /^Open Google Calendar event Design sync\./,
      })
    );

    expect(open).toHaveBeenCalledWith(
      "https://calendar.google.com/event?eid=1",
      "_blank",
      "noopener,noreferrer"
    );
    expect(getState().ui.selectedTaskId).toBeNull();
  });

  it("re-syncs stale Google events when the Calendar page is revisited", async () => {
    const { api } = await seedStore({
      googleConnection: { email: "sam@example.com" },
      googleEvents: [googleEvent],
    });
    const firstVisit = await renderCalendar();
    expect(api.callCount("syncGoogleCalendar")).toBe(1);
    firstVisit.unmount();

    vi.setSystemTime(new Date(TODAY.getTime() + GOOGLE_EVENTS_STALE_MS + 1));
    api.data.googleEvents.push({
      ...googleEvent,
      id: "evt-2",
      title: "Planning review",
    });
    await renderCalendar();

    expect(api.callCount("syncGoogleCalendar")).toBe(2);
    expect(
      await screen.findByRole("button", {
        name: /^Open Google Calendar event Planning review\./,
      })
    ).toBeInTheDocument();
  });

  it("creates a task on the selected day from the day agenda", async () => {
    const { api } = await seedStore();
    await renderCalendar();

    await user.type(
      screen.getByRole("textbox", { name: `Task name for ${fullDate(2026, 8, 2)}` }),
      "Draft agenda"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(api.callCount("createTask")).toBe(1));
    expect(api.callsOf("createTask")[0][0]).toMatchObject({
      title: "Draft agenda",
      dueDate: "2026-09-02",
      projectId: null,
    });
  });

  it("shows the loading skeleton only while a task load holds no data", async () => {
    await seedStore();
    const pending = loadTasks();

    renderPage(<CalendarPage />);
    expect(
      screen.getByRole("status", { name: "Loading calendar" })
    ).toBeInTheDocument();

    await act(async () => {
      await pending;
    });
    expect(
      screen.queryByRole("status", { name: "Loading calendar" })
    ).not.toBeInTheDocument();
  });

  it("reports a failed task load and retries on demand", async () => {
    const { api } = await seedStore({ tasks: [brief] });
    api.failNext("listPersonalTasks", new Error("offline"));
    await loadTasks();

    await renderCalendar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your tasks."
    );

    const before = api.callCount("listPersonalTasks");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(api.callCount("listPersonalTasks")).toBe(before + 1)
    );
  });
});
