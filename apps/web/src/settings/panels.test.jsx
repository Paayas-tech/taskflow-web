import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchivedProjectsPanel, CalendarsPanel, RemindersPanel } from "./panels";
import { getState } from "../store/store";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";

vi.mock("../api/calendar", () => ({
  getGoogleConnection: vi.fn(),
  startGoogleOAuth: vi.fn(),
  syncGoogleCalendar: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
}));

const { getGoogleConnection, syncGoogleCalendar } = await import("../api/calendar");

beforeEach(() => {
  vi.clearAllMocks();
  getGoogleConnection.mockResolvedValue(null);
});

describe("RemindersPanel", () => {
  it("keeps the offset a draft until the field blurs", async () => {
    const user = userEvent.setup();
    const commit = vi.fn(async () => true);
    await seedStore();
    renderPage(<RemindersPanel commit={commit} />);

    const offset = screen.getByLabelText("Remind me");
    await user.clear(offset);
    await user.type(offset, "45");
    expect(commit).not.toHaveBeenCalled();

    await user.tab();
    expect(commit).toHaveBeenCalledWith("reminder", { defaultTime: 45 }, "");
  });

  it("commits a delivery toggle immediately", async () => {
    const user = userEvent.setup();
    const commit = vi.fn(async () => true);
    await seedStore();
    renderPage(<RemindersPanel commit={commit} />);

    await user.click(screen.getByRole("checkbox", { name: "In-app reminders" }));

    expect(commit).toHaveBeenCalledWith("reminder", { enableInAppReminders: false }, "");
  });
});

describe("ArchivedProjectsPanel", () => {
  it("restores an archived project", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({
      projects: [
        makeProject({
          id: "project-archived",
          name: "Old site",
          status: "archived",
          archivedAt: "2026-02-01T09:00:00.000Z",
        }),
      ],
    });
    renderPage(<ArchivedProjectsPanel />);

    expect(screen.getByText("Old site")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(api.callCount("updateProject")).toBe(1));
    expect(api.callsOf("updateProject")[0][0]).toBe("project-archived");
    expect(api.callsOf("updateProject")[0][1].status).toBe("active");
    expect(getState().projects["project-archived"].status).toBe("active");
    expect(screen.getByText("Old site restored.")).toBeInTheDocument();
    expect(screen.getByText("No archived projects")).toBeInTheDocument();
  });
});

describe("CalendarsPanel", () => {
  it("offers a connect action while Google Calendar is disconnected", async () => {
    await seedStore();
    renderPage(<CalendarsPanel commit={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Connect Google" })).toBeEnabled();
    expect(getGoogleConnection).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
  });

  it("syncs a connected calendar into the store's Google events", async () => {
    const user = userEvent.setup();
    getGoogleConnection.mockResolvedValue({
      calendar_account_email: "sam@example.com",
      sync_status: "success",
      last_synced_at: null,
    });
    syncGoogleCalendar.mockResolvedValue({
      events: [{ id: "google-1", title: "Standup" }],
      calendars: [{ id: "primary" }, { id: "team" }],
    });
    await seedStore();
    renderPage(<CalendarsPanel commit={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(getState().googleEvents).toHaveLength(1));
    expect(screen.getByText("Google Calendar synced.")).toBeInTheDocument();
    expect(screen.getByText("2 calendars · 1 events")).toBeInTheDocument();
  });
});
