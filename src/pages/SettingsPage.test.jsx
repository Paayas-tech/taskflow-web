import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./SettingsPage";
import { getState } from "../store/store";
import { openProfileSettings } from "../store/ui";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";

vi.mock("../api/auth", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../api/calendar", () => ({
  getGoogleConnection: vi.fn(async () => null),
  startGoogleOAuth: vi.fn(),
  syncGoogleCalendar: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
}));

const { deleteAccount, signOut } = await import("../api/auth");

const PANEL_ROWS = [
  "Profile",
  "Archived projects",
  "Project reminders",
  "My day",
  "Calendars",
  "Theme",
  "Default view",
  "Time settings",
  "Language",
  "Keyboard shortcuts",
  "About",
];

const openPanel = async (user, name) =>
  user.click(screen.getByRole("button", { name }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

describe("SettingsPage", () => {
  it("shows the account and every settings group", async () => {
    await seedStore();
    renderPage(<SettingsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
    ["Account", "Projects", "Preferences", "TaskFlow"].forEach((group) => {
      expect(screen.getByRole("heading", { level: 2, name: group })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Theme/ })).toHaveTextContent("Light");
  });

  it("opens each panel and steps back one level at a time", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<SettingsPage />);

    for (const row of PANEL_ROWS) {
      await openPanel(user, new RegExp(`^${row}`));
      expect(screen.getByRole("heading", { level: 1, name: row })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    }

    await openPanel(user, /^Time settings/);
    await openPanel(user, /^Date format/);
    expect(screen.getByRole("heading", { level: 1, name: "Date format" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1, name: "Time settings" })).toBeInTheDocument();
  });

  it("saves a theme choice through the api and returns to the overview", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore();
    renderPage(<SettingsPage />);

    await openPanel(user, /^Theme/);
    expect(screen.getByRole("heading", { level: 1, name: "Theme" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Dark/ }));

    await waitFor(() => expect(api.callCount("saveSettings")).toBe(1));
    expect(api.callsOf("saveSettings")[0][1].theme.mode).toBe("dark");
    expect(getState().settings.theme.mode).toBe("dark");
    expect(screen.getByText("Theme saved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Theme/ })).toHaveTextContent("Dark");
  });

  it("reports a failed save without keeping the change", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore();
    renderPage(<SettingsPage />);

    api.failNext("saveSettings", new Error("Network unavailable."));
    await openPanel(user, /^Theme/);
    await user.click(screen.getByRole("radio", { name: /Dark/ }));

    expect(await screen.findByText("Network unavailable.")).toBeInTheDocument();
    expect(getState().settings.theme.mode).toBe("light");
  });

  it("saves a new display name from the profile panel", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore();
    renderPage(<SettingsPage />);

    await openPanel(user, /^Profile/);
    const field = screen.getByLabelText("Display name");
    await user.clear(field);
    await user.type(field, "Sam R.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.callCount("saveSettings")).toBe(1));
    expect(api.callsOf("saveSettings")[0][1].profile.displayName).toBe("Sam R.");
    expect(getState().settings.profile.displayName).toBe("Sam R.");
  });

  it("opens the profile panel when the user menu asks for it", async () => {
    await seedStore();
    renderPage(<SettingsPage />);

    await act(async () => {
      openProfileSettings();
    });

    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Sam Rivera");
    expect(getState().ui.profileSettingsRequest).toBe(0);
  });

  it("signs out from the profile panel", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<SettingsPage />);

    await openPanel(user, /^Profile/);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("exports the account data as JSON", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:taskflow");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await seedStore({
      projects: [makeProject({ id: "project-export", name: "Website relaunch" })],
      tasks: [
        makeTask({ title: "Write the brief" }),
        makeTask({ title: "Old newsletter", archivedAt: "2026-08-20T09:00:00.000Z" }),
      ],
    });
    renderPage(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /^Export data/ }));

    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    const payload = JSON.parse(await blob.text());
    expect(payload.version).toBe(1);
    expect(payload.settings.profile.email).toBe("sam@example.com");
    // A backup covers the archived tasks too, not just the active ones.
    expect(payload.tasks.map((task) => task.title).sort()).toEqual([
      "Old newsletter",
      "Write the brief",
    ]);
    expect(payload.projects.map((project) => project.name)).toEqual(["Website relaunch"]);
  });

  it("confirms before deleting the account", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<SettingsPage />);

    await openPanel(user, /^Profile/);
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete your account?",
    });
    expect(deleteAccount).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getState().auth.status).toBe("signed-out"));
  });

  it("keeps the account and explains a failed deletion", async () => {
    const user = userEvent.setup();
    deleteAccount.mockRejectedValueOnce(new Error("offline"));
    await seedStore();
    renderPage(<SettingsPage />);

    await openPanel(user, /^Profile/);
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete your account?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Delete account" }));

    expect(
      await screen.findByText("We couldn't delete your account. Please try again.")
    ).toBeInTheDocument();
    expect(getState().auth.status).toBe("ready");
  });

  it("keeps desktop notifications off when the browser blocks permission", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: vi.fn() });
    const { api } = await seedStore({
      settings: { reminder: { enableBrowserNotifications: false } },
    });
    renderPage(<SettingsPage />);

    const toggle = screen.getByRole("checkbox", { name: "Desktop notifications" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    expect(
      await screen.findByText(
        "TaskFlow notifications remain off because browser permission is blocked."
      )
    ).toBeInTheDocument();
    expect(api.callsOf("saveSettings")[0][1].reminder.enableBrowserNotifications).toBe(
      false
    );
    expect(screen.getByRole("checkbox", { name: "Desktop notifications" })).not.toBeChecked();
  });
});
