import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("./test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const googleService = vi.hoisted(() => ({
  getConnection: vi.fn(),
  startOAuth: vi.fn(),
  sync: vi.fn(),
  disconnect: vi.fn(),
}));
const requestNotificationPermission = vi.hoisted(() => vi.fn());

vi.mock("./application/googleCalendarIntegrationService", () => ({
  googleCalendarIntegrationService: googleService,
}));
vi.mock("./services/reminderService", () => ({ requestNotificationPermission }));

import SettingsPage from "./SettingsPage";
import { DEFAULT_SETTINGS } from "./domain/settingsDomain";
import { find, findAll, props, render, textContent } from "./test/elementTree";

const flush = async () => {
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
};

const baseProps = (overrides = {}) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  error: "",
  saving: false,
  saveMessage: "",
  onRetry: vi.fn(),
  onChange: vi.fn(),
  onSave: vi.fn(),
  onCommit: vi.fn().mockResolvedValue(undefined),
  onSignOut: vi.fn(),
  onDeleteAccount: vi.fn(),
  onNavigate: vi.fn(),
  onOpenProjectCreate: vi.fn(),
  onRestoreProject: vi.fn(),
  onGoogleEventsChange: vi.fn(),
  exportData: { projects: [] },
  ...overrides,
});

function mount(overrides = {}) {
  const runner = runtime.createRunner(SettingsPage, baseProps(overrides));
  runner.render();
  runner.render();

  const session = {
    runner,
    get props() {
      return runner.props;
    },
    view: () => render(runner.output, 8),
    // Two passes: the first runs the effects, the second renders what they changed.
    rerender: (nextProps) => {
      runner.render(nextProps ?? runner.props);
      runner.render(nextProps ?? runner.props);
      return session.view();
    },
  };
  return session;
}

const button = (root, label) =>
  find(root, (node) => node.type === "button" && textContent(node).trim() === label);

const row = (root, label) =>
  find(root, (node) => node.type === "button" && textContent(node).startsWith(label));

const pageTitle = (root) =>
  textContent(find(root, (node) => props(node).className === "page-title"));

const statusText = (root) =>
  findAll(root, (node) => props(node).role === "status")
    .map((node) => textContent(node))
    .join(" ");

function open(session, label) {
  props(row(session.view(), label)).onClick();
  return session.rerender();
}

function goBack(session) {
  props(button(session.view(), "Back")).onClick();
  return session.rerender();
}

beforeEach(() => {
  googleService.getConnection.mockResolvedValue(null);
  googleService.sync.mockResolvedValue({ calendars: [], events: [], lastSyncedAt: null });
  googleService.disconnect.mockResolvedValue(undefined);
  requestNotificationPermission.mockResolvedValue("granted");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPage overview", () => {
  it("shows the account header and the four setting groups", () => {
    const session = mount({
      settings: {
        ...DEFAULT_SETTINGS,
        profile: { displayName: "Priya Shah", email: "priya@example.com" },
      },
    });
    const view = session.view();

    expect(pageTitle(view)).toBe("Settings");
    expect(
      findAll(view, (node) => props(node).className === "settings-group-title").map(textContent)
    ).toEqual(["Account", "Projects", "Preferences", "TaskFlow"]);
    expect(textContent(find(view, (node) => props(node).className === "settings-account-name"))).toBe(
      "Priya Shah"
    );
    expect(textContent(view)).toContain("priya@example.com");
    expect(find(view, (node) => String(props(node).className || "").startsWith("avatar"))).toBeDefined();
  });

  it("drops the retired rows and keeps the ones the redesign kept", () => {
    const text = textContent(mount().view());

    for (const removed of [
      "Background",
      "Default list",
      "Import data",
      "External suggestions",
      "Reset filter suggestions",
      "What's new",
    ]) {
      expect(text).not.toContain(removed);
    }
    for (const kept of [
      "Profile",
      "Archived tasks",
      "Project reminders",
      "Archived projects",
      "My day",
      "Calendars",
      "Theme",
      "Desktop notifications",
      "Default view",
      "Time settings",
      "Language",
      "Keyboard shortcuts",
      "About",
    ]) {
      expect(text).toContain(kept);
    }
  });

  it("keeps account actions out of the overview and behind the profile panel", () => {
    const session = mount();

    expect(textContent(session.view())).not.toContain("Sign out");

    const profile = open(session, "Profile");
    expect(pageTitle(profile)).toBe("Profile");
    expect(button(profile, "Sign out")).toBeDefined();
    expect(button(profile, "Delete account")).toBeDefined();
  });

  it("offers a retry when settings could not be loaded", () => {
    const session = mount({ error: "Settings could not be loaded." });
    const alert = find(session.view(), (node) => props(node).role === "alert");

    expect(textContent(alert)).toContain("Settings could not be loaded.");
    props(button(alert, "Retry")).onClick();
    expect(session.props.onRetry).toHaveBeenCalledOnce();
  });

  it("shows a loading state before the settings arrive", () => {
    const view = mount({ loading: true }).view();

    expect(pageTitle(view)).toBe("Settings");
    expect(statusText(view)).toContain("Loading settings");
  });
});

describe("SettingsPage panel navigation", () => {
  it("opens the profile panel on request and returns to the overview from Back", () => {
    const session = mount({ profileRequest: 1 });
    const profile = session.view();

    expect(pageTitle(profile)).toBe("Profile");
    expect(props(find(profile, (node) => props(node).id === "settings-email")).readOnly).toBe(true);

    const overview = goBack(session);
    expect(pageTitle(overview)).toBe("Settings");
    expect(find(overview, (node) => props(node).className === "settings-overview")).toBeDefined();
  });

  it("opens the profile panel even when another panel is already open", () => {
    const session = mount();
    open(session, "Theme");
    expect(pageTitle(session.view())).toBe("Theme");

    const profile = session.rerender(baseProps({ profileRequest: 1 }));
    expect(pageTitle(profile)).toBe("Profile");
  });

  it("walks into a time sub-panel and back out one level at a time", () => {
    const session = mount();

    open(session, "Time settings");
    expect(pageTitle(session.view())).toBe("Time settings");

    open(session, "Week starts on");
    expect(pageTitle(session.view())).toBe("Week starts on");
    props(
      find(session.view(), (node) => props(node).type === "radio" && props(node).value === "monday")
    ).onChange();
    expect(session.props.onCommit).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      time: { ...DEFAULT_SETTINGS.time, weekStartsOn: "monday" },
    });

    expect(pageTitle(goBack(session))).toBe("Time settings");
    expect(pageTitle(goBack(session))).toBe("Settings");
  });
});

describe("SettingsPage preference commits", () => {
  it("commits a theme change immediately and reports it", async () => {
    const session = mount();
    open(session, "Theme");
    const dark = find(
      session.view(),
      (node) => props(node).type === "radio" && props(node).value === "dark"
    );

    await expect(props(dark).onChange()).resolves.toBeUndefined();
    const expected = { ...DEFAULT_SETTINGS, theme: { mode: "dark" } };
    expect(session.props.onChange).toHaveBeenCalledWith(expected);
    expect(session.props.onCommit).toHaveBeenCalledWith(expected);
    expect(statusText(session.rerender())).toContain("Theme saved.");
  });

  it("leaves error reporting to the app when a commit fails", async () => {
    const session = mount({ onCommit: vi.fn().mockRejectedValue(new Error("offline")) });
    open(session, "Theme");
    const dark = find(
      session.view(),
      (node) => props(node).type === "radio" && props(node).value === "dark"
    );

    await props(dark).onChange();
    const view = session.rerender();
    expect(find(view, (node) => props(node).role === "alert")).toBeUndefined();
    expect(statusText(view)).not.toContain("Theme saved.");
  });

  it("offers the redesigned default-view options and commits the chosen one", () => {
    const session = mount();
    open(session, "Default view");
    const view = session.view();

    expect(
      findAll(view, (node) => props(node).className === "option-label").map(textContent)
    ).toEqual(["Home", "My tasks", "Projects", "Calendar", "Last viewed"]);
    props(
      find(view, (node) => props(node).type === "radio" && props(node).value === "tasks")
    ).onChange();
    expect(session.props.onCommit).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      navigation: { ...DEFAULT_SETTINGS.navigation, defaultView: "tasks" },
    });
  });

  it("asks for browser permission before enabling desktop notifications", async () => {
    const session = mount({
      settings: {
        ...DEFAULT_SETTINGS,
        reminder: { ...DEFAULT_SETTINGS.reminder, enableBrowserNotifications: false },
      },
    });
    const toggle = find(
      session.view(),
      (node) => props(node)["aria-label"] === "Desktop notifications"
    );

    props(toggle).onChange({ target: { checked: true } });
    await flush();
    expect(requestNotificationPermission).toHaveBeenCalledOnce();
    expect(session.props.onCommit).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, enableBrowserNotifications: true },
    });
    expect(statusText(session.rerender())).toContain("browser permission is granted");
  });

  it("keeps notifications off and explains why when permission is blocked", async () => {
    requestNotificationPermission.mockResolvedValue("denied");
    const session = mount();
    const toggle = find(
      session.view(),
      (node) => props(node)["aria-label"] === "Desktop notifications"
    );

    props(toggle).onChange({ target: { checked: true } });
    await flush();
    expect(session.props.onCommit).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, enableBrowserNotifications: false },
    });
    expect(statusText(session.rerender())).toContain("browser permission is blocked");
  });

  it("reveals the custom reset-time field only for the custom My day mode", () => {
    const session = mount();
    open(session, "My day");

    expect(find(session.view(), (node) => props(node).type === "time")).toBeUndefined();

    const custom = session.rerender(
      baseProps({
        settings: {
          ...DEFAULT_SETTINGS,
          myDay: { ...DEFAULT_SETTINGS.myDay, resetMode: "custom" },
        },
      })
    );
    const time = find(custom, (node) => props(node).type === "time");

    expect(props(time).value).toBe("00:00");
    props(time).onChange({ target: { value: "07:30" } });
    expect(session.props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        myDay: expect.objectContaining({ resetMode: "custom", customResetTime: "07:30" }),
      })
    );
  });

  it("lists the real keyboard shortcuts and the about details", () => {
    const session = mount();
    open(session, "Keyboard shortcuts");
    const shortcutText = textContent(session.view());

    expect(shortcutText).toContain("Open search");
    expect(shortcutText).toContain("⌘K");
    expect(shortcutText).toContain("Esc");

    goBack(session);
    open(session, "About");
    expect(textContent(session.view())).toContain("Version 0.0.0");
  });
});

describe("SettingsPage profile panel", () => {
  it("saves the profile form only when the settings are valid", () => {
    const session = mount({ profileRequest: 1 });
    const form = find(session.view(), (node) => node.type === "form");

    props(form).onSubmit({ preventDefault: vi.fn() });
    expect(session.props.onSave).toHaveBeenCalledWith(DEFAULT_SETTINGS);

    const invalid = {
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, defaultTime: 0 },
    };
    const invalidView = session.rerender(baseProps({ profileRequest: 1, settings: invalid }));
    props(find(invalidView, (node) => node.type === "form")).onSubmit({ preventDefault: vi.fn() });
    expect(textContent(invalidView)).toContain(
      "Default reminder time must be a whole number from 1 to 1440 minutes."
    );
  });

  it("puts a display-name problem on the field instead of the page notice", () => {
    const session = mount({
      profileRequest: 1,
      settings: {
        ...DEFAULT_SETTINGS,
        profile: { ...DEFAULT_SETTINGS.profile, displayName: "x".repeat(81) },
      },
    });
    const alerts = findAll(session.view(), (node) => props(node).role === "alert");

    expect(alerts).toHaveLength(1);
    expect(props(alerts[0]).className).toBe("field-error");
    expect(textContent(alerts[0])).toContain("Display name must be 80 characters or fewer.");
  });

  it("confirms before deleting the account", () => {
    const session = mount({ profileRequest: 1 });

    props(button(session.view(), "Delete account")).onClick();
    const dialog = find(session.rerender(), (node) => props(node).role === "alertdialog");

    expect(props(dialog)["aria-label"]).toBe("Delete your account?");
    props(button(dialog, "Delete account")).onClick();
    expect(session.props.onDeleteAccount).toHaveBeenCalledOnce();
  });
});

describe("SettingsPage project reminders", () => {
  it("keeps offset edits draft-only and commits the toggles immediately", () => {
    const session = mount();
    open(session, "Project reminders");
    const view = session.view();

    props(find(view, (node) => props(node).type === "number")).onChange({
      target: { value: "45" },
    });
    expect(session.props.onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, defaultTime: 45 },
    });
    expect(session.props.onCommit).not.toHaveBeenCalled();

    session.props.onChange.mockClear();
    const [inApp] = findAll(view, (node) => props(node).type === "checkbox");
    props(inApp).onChange({ target: { checked: false } });
    const expected = {
      ...DEFAULT_SETTINGS,
      reminder: { ...DEFAULT_SETTINGS.reminder, enableInAppReminders: false },
    };
    expect(session.props.onChange).toHaveBeenCalledWith(expected);
    expect(session.props.onCommit).toHaveBeenCalledWith(expected);
  });
});

describe("SettingsPage archived projects", () => {
  const archivedProject = {
    id: "project/id with spaces",
    name: "Archived Alpha",
    description: "Archived project description",
    status: "archived",
  };

  const mountWithArchived = (overrides = {}) =>
    mount({ exportData: { projects: [archivedProject] }, ...overrides });

  it("navigates to an archived project with an encoded id", () => {
    const session = mountWithArchived();
    open(session, "Archived projects");

    props(button(session.view(), "Open")).onClick();
    expect(session.props.onNavigate).toHaveBeenCalledWith(
      `/projects/${encodeURIComponent(archivedProject.id)}`
    );
  });

  it("marks the row busy while restoring and reports the result", async () => {
    let resolveRestore;
    const restorePending = new Promise((resolve) => { resolveRestore = resolve; });
    const session = mountWithArchived({ onRestoreProject: vi.fn(() => restorePending) });
    open(session, "Archived projects");

    props(button(session.view(), "Restore")).onClick();
    expect(session.props.onRestoreProject).toHaveBeenCalledWith(archivedProject.id);
    expect(props(button(session.rerender(), "Restore"))["aria-busy"]).toBe(true);

    resolveRestore();
    await flush();
    const view = session.rerender();
    expect(props(button(view, "Restore")).disabled).toBe(false);
    expect(statusText(view)).toContain("Archived Alpha restored.");
  });

  it("keeps the restore failure message free of provider details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const session = mountWithArchived({
      onRestoreProject: vi.fn().mockRejectedValue(new Error("provider details")),
    });
    open(session, "Archived projects");

    props(button(session.view(), "Restore")).onClick();
    await flush();
    const view = session.rerender();

    expect(statusText(view)).toContain("We couldn't restore Archived Alpha. Try again.");
    expect(statusText(view)).not.toContain("provider details");
    expect(props(button(view, "Restore")).disabled).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("SettingsPage calendars", () => {
  it("loads the Google connection when the panel opens and syncs on demand", async () => {
    googleService.getConnection.mockResolvedValue({
      calendar_account_email: "calendar@example.com",
      sync_status: "success",
    });
    googleService.sync.mockResolvedValue({
      calendars: [{ id: "primary" }],
      events: [{ id: "event-1" }],
      lastSyncedAt: "2026-09-01T09:00:00.000Z",
    });
    const session = mount();

    open(session, "Calendars");
    expect(googleService.getConnection).toHaveBeenCalledOnce();
    await flush();
    expect(textContent(session.rerender())).toContain("calendar@example.com");

    props(button(session.view(), "Sync now")).onClick();
    await flush();
    const view = session.rerender();

    expect(googleService.sync).toHaveBeenCalledOnce();
    expect(session.props.onGoogleEventsChange).toHaveBeenCalledWith([{ id: "event-1" }]);
    expect(statusText(view)).toContain("Google Calendar synced.");
  });

  it("confirms before disconnecting Google Calendar and clears the synced events", async () => {
    googleService.getConnection.mockResolvedValue({ calendar_account_email: "calendar@example.com" });
    const session = mount();

    open(session, "Calendars");
    await flush();
    session.rerender();

    props(button(session.view(), "Disconnect")).onClick();
    const dialog = find(session.rerender(), (node) => props(node).role === "alertdialog");
    expect(props(dialog)["aria-label"]).toBe("Disconnect Google Calendar?");

    props(button(dialog, "Disconnect")).onClick();
    await flush();
    const view = session.rerender();

    expect(googleService.disconnect).toHaveBeenCalledOnce();
    expect(session.props.onGoogleEventsChange).toHaveBeenCalledWith([]);
    expect(statusText(view)).toContain("Google Calendar disconnected.");
  });

  it("surfaces a failed connection start without leaving the button busy", async () => {
    googleService.startOAuth.mockRejectedValue(new Error("Google is unavailable."));
    const session = mount();

    open(session, "Calendars");
    await flush();
    session.rerender();

    props(button(session.view(), "Connect Google")).onClick();
    await flush();
    const view = session.rerender();

    expect(textContent(find(view, (node) => props(node).role === "alert"))).toContain(
      "Google is unavailable."
    );
    expect(props(button(view, "Connect Google")).disabled).toBe(false);
  });

  it("opens the setup dialog for a provider that cannot be connected yet", () => {
    const session = mount();
    open(session, "Calendars");

    props(button(session.view(), "Set up")).onClick();
    const dialog = find(session.rerender(), (node) => props(node).role === "dialog");

    expect(props(dialog)["aria-label"]).toBe("Connect Microsoft Outlook");
    expect(props(button(dialog, "Authorization unavailable")).disabled).toBe(true);

    props(find(session.view(), (node) => props(node)["aria-label"] === "Close")).onClick();
    expect(find(session.rerender(), (node) => props(node).role === "dialog")).toBeUndefined();
  });
});
