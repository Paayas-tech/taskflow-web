import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

import { find, findAll, props, render, textContent } from "../test/elementTree";
import { DEFAULT_SETTINGS } from "../domain/settingsDomain";
import { CALENDAR_PROVIDERS } from "../domain/calendarConnectionDomain";
import CalendarConnectionSection from "./CalendarConnectionSection";
import ProfileSettingsPanel from "./ProfileSettingsPanel";
import SettingsSignOutSection from "./SettingsSignOutSection";
import {
  SelectionRows,
  SettingsGroup,
  SettingsRow,
  ToggleRow,
} from "./SettingsControls";
import {
  AccountSettingsSection,
  PreferencesSettingsSection,
  ProjectsSettingsSection,
  TaskflowSettingsSection,
} from "./SettingsOverviewSections";

const tree = (node) => render(node, 8);

const button = (root, label) =>
  find(root, (node) => node.type === "button" && textContent(node).trim() === label);

const checkboxes = (root) =>
  findAll(root, (node) => node.type === "input" && props(node).type === "checkbox");

describe("settings controls", () => {
  it("renders a navigating row with its value and a chevron", () => {
    const onClick = vi.fn();
    const row = tree(SettingsRow({ label: "Theme", value: "Light", onClick }));

    expect(props(row).className).toBe("settings-row");
    expect(textContent(row)).toBe("Theme Light");
    expect(find(row, (node) => props(node).className === "icon settings-row-chevron")).toBeDefined();
    props(row).onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("groups rows under an uppercase title that labels the group", () => {
    const group = tree(SettingsGroup({ title: "Preferences", children: "rows" }));
    const heading = find(group, (node) => node.type === "h2");

    expect(props(group)["aria-labelledby"]).toBe(props(heading).id);
    expect(textContent(heading)).toBe("Preferences");
    expect(props(heading).className).toBe("settings-group-title");
  });

  it("renders a toggle row as a labelled switch and reports the checked state", () => {
    const onChange = vi.fn();
    const row = tree(
      ToggleRow({ label: "Reminder sound", description: "Play a sound.", checked: true, onChange })
    );
    const [input] = checkboxes(row);
    const control = find(row, (node) => props(node).className === "checkbox switch");

    expect(control).toBeDefined();
    expect(props(input)["aria-label"]).toBe("Reminder sound");
    expect(props(input).checked).toBe(true);
    props(input).onChange({ target: { checked: false } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("marks the selected option row with a check and reports the chosen value", () => {
    const onSelect = vi.fn();
    const list = tree(
      SelectionRows({
        ariaLabel: "Theme",
        value: "light",
        onSelect,
        options: [
          ["light", "Light", "Always light"],
          ["dark", "Dark", "Always dark"],
        ],
      })
    );
    const rows = findAll(list, (node) => String(props(node).className || "").startsWith("option-row"));
    const dark = find(list, (node) => props(node).type === "radio" && props(node).value === "dark");

    expect(props(list).role).toBe("radiogroup");
    expect(props(list)["aria-label"]).toBe("Theme");
    expect(rows.map((row) => props(row).className)).toEqual([
      "option-row is-selected",
      "option-row",
    ]);
    expect(find(rows[0], (node) => props(node).className === "icon option-check")).toBeDefined();
    expect(find(rows[1], (node) => props(node).className === "icon option-check")).toBeUndefined();
    props(dark).onChange();
    expect(onSelect).toHaveBeenCalledWith("dark");
  });
});

describe("settings overview sections", () => {
  it("renders account navigation and forwards each account action", () => {
    const callbacks = {
      onOpenProfile: vi.fn(),
      onOpenArchivedTasks: vi.fn(),
      onExportData: vi.fn(),
    };
    const output = tree(AccountSettingsSection({ displayName: "Priya Shah", ...callbacks }));

    expect(textContent(find(output, (node) => node.type === "h2"))).toBe("Account");
    expect(textContent(output)).toContain("Priya Shah");
    expect(textContent(output)).not.toContain("Import data");
    button(output, "Profile Priya Shah").props.onClick();
    button(output, "Archived tasks").props.onClick();
    button(output, "Export data JSON").props.onClick();
    Object.values(callbacks).forEach((callback) => expect(callback).toHaveBeenCalledOnce());
  });

  it("renders project values and forwards reminder, archive, and create actions", () => {
    const onOpenProjectReminders = vi.fn();
    const onOpenArchivedProjects = vi.fn();
    const onOpenProjectCreate = vi.fn();
    const output = tree(
      ProjectsSettingsSection({
        defaultReminderTime: 30,
        archivedProjectCount: 2,
        onOpenProjectReminders,
        onOpenArchivedProjects,
        onOpenProjectCreate,
      })
    );

    expect(textContent(output)).toContain("30 min");
    expect(textContent(output)).toContain("Archived projects 2");
    button(output, "Project reminders 30 min").props.onClick();
    button(output, "Archived projects 2").props.onClick();
    button(output, "New project").props.onClick();
    expect(onOpenProjectReminders).toHaveBeenCalledOnce();
    expect(onOpenArchivedProjects).toHaveBeenCalledOnce();
    expect(onOpenProjectCreate).toHaveBeenCalledOnce();
  });

  it("keeps the preference rows the redesign kept and drops the retired ones", () => {
    const onOpenTheme = vi.fn();
    const onToggleBrowserNotifications = vi.fn();
    const output = tree(
      PreferencesSettingsSection({
        myDayLabel: "12:00 AM",
        connectedCalendarCount: 1,
        themeLabel: "Dark",
        browserNotificationsEnabled: true,
        defaultViewLabel: "Home",
        timeSettingsLabel: "12 hour · Monday",
        languageLabel: "Français",
        onOpenMyDay: vi.fn(),
        onOpenCalendars: vi.fn(),
        onOpenTheme,
        onToggleBrowserNotifications,
        onOpenDefaultView: vi.fn(),
        onOpenTimeSettings: vi.fn(),
        onOpenLanguage: vi.fn(),
      })
    );
    const [notificationToggle] = checkboxes(output);

    expect(textContent(output)).toContain("1 connected");
    expect(textContent(output)).not.toContain("Background");
    expect(textContent(output)).not.toContain("Default list");
    expect(notificationToggle.props.checked).toBe(true);
    button(output, "Theme Dark").props.onClick();
    notificationToggle.props.onChange({ target: { checked: false } });
    expect(onOpenTheme).toHaveBeenCalledOnce();
    expect(onToggleBrowserNotifications).toHaveBeenCalledWith(false);
  });

  it("renders TaskFlow information navigation without the release notes row", () => {
    const onOpenShortcuts = vi.fn();
    const onOpenAbout = vi.fn();
    const output = tree(TaskflowSettingsSection({ onOpenShortcuts, onOpenAbout }));

    expect(textContent(output)).not.toContain("What's new");
    expect(textContent(output)).toContain("About 0.0.0");
    button(output, "Keyboard shortcuts").props.onClick();
    button(output, "About 0.0.0").props.onClick();
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
    expect(onOpenAbout).toHaveBeenCalledOnce();
  });
});

describe("ProfileSettingsPanel", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    profile: { displayName: "Current", email: "person@example.com" },
  };

  it("keeps the display-name payload, the read-only email and the busy save button", () => {
    const onChange = vi.fn();
    const output = tree(ProfileSettingsPanel({ settings, saving: true, onChange }));
    const name = find(output, (node) => props(node).id === "settings-display-name");
    const email = find(output, (node) => props(node).id === "settings-email");
    const save = button(output, "Save");

    expect(props(name).disabled).toBe(true);
    expect(props(name).maxLength).toBe(80);
    expect(props(email).readOnly).toBe(true);
    expect(props(email).disabled).toBe(true);
    expect(props(save).disabled).toBe(true);
    expect(props(save)["aria-busy"]).toBe(true);
    props(name).onChange({ target: { value: "Updated" } });
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      profile: { ...settings.profile, displayName: "Updated" },
    });
  });

  it("submits the profile form and surfaces a validation error on the field", () => {
    const onSave = vi.fn();
    const preventDefault = vi.fn();
    const output = tree(
      ProfileSettingsPanel({
        settings,
        onChange: vi.fn(),
        onSave,
        error: "Display name must be 80 characters or fewer.",
      })
    );
    const form = find(output, (node) => node.type === "form");
    const fieldError = find(output, (node) => props(node).className === "field-error");

    props(form).onSubmit({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(textContent(fieldError)).toBe("Display name must be 80 characters or fewer.");
    expect(props(fieldError).role).toBe("alert");
  });

  it("keeps the account actions inside the profile panel", () => {
    const output = tree(ProfileSettingsPanel({ settings, onChange: vi.fn() }));

    expect(button(output, "Sign out")).toBeDefined();
    expect(button(output, "Delete account")).toBeDefined();
  });
});

describe("SettingsSignOutSection", () => {
  it("preserves sign-out pending semantics, error ownership, and action", () => {
    const onSignOut = vi.fn();
    const output = tree(
      SettingsSignOutSection({ onSignOut, pending: true, error: "Try again." })
    );
    const signOut = button(output, "Sign out");
    const alert = find(output, (node) => props(node).role === "alert");

    expect(props(signOut).disabled).toBe(true);
    expect(props(signOut)["aria-busy"]).toBe(true);
    expect(props(signOut)["aria-describedby"]).toBe(props(alert).id);
    expect(textContent(alert)).toContain("Try again.");
    props(signOut).onClick();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("confirms account deletion in an alert dialog before running it", () => {
    const onDeleteAccount = vi.fn();
    const onCancelDelete = vi.fn();
    const output = tree(
      SettingsSignOutSection({
        onSignOut: vi.fn(),
        onDeleteAccount,
        confirmingDelete: true,
        onCancelDelete,
      })
    );
    const dialog = find(output, (node) => props(node).role === "alertdialog");

    expect(props(dialog)["aria-modal"]).toBe("true");
    expect(props(dialog)["aria-label"]).toBe("Delete your account?");
    expect(textContent(dialog)).toContain("permanently deleted");
    button(dialog, "Delete account").props.onClick();
    expect(onDeleteAccount).toHaveBeenCalledOnce();
    button(dialog, "Cancel").props.onClick();
    expect(onCancelDelete).toHaveBeenCalledOnce();
  });

  it("hides the confirmation until deletion is requested", () => {
    const output = tree(SettingsSignOutSection({ onSignOut: vi.fn() }));

    expect(find(output, (node) => props(node).role === "alertdialog")).toBeUndefined();
  });
});

describe("CalendarConnectionSection", () => {
  const renderSection = (overrides = {}) =>
    tree(
      CalendarConnectionSection({
        settings: DEFAULT_SETTINGS,
        selectedProvider: null,
        setup: null,
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onConnectGoogle: vi.fn(),
        onSyncGoogle: vi.fn(),
        onRequestGoogleDisconnect: vi.fn(),
        onCancelGoogleDisconnect: vi.fn(),
        onDisconnectGoogle: vi.fn(),
        onRetryGoogle: vi.fn(),
        onCloseSetup: vi.fn(),
        ...overrides,
      })
    );

  it("offers a Google connect action and a badge while disconnected", () => {
    const onConnectGoogle = vi.fn();
    const output = renderSection({ onConnectGoogle });
    const badge = find(output, (node) => props(node).className === "badge badge-neutral");

    expect(textContent(badge)).toBe("Not connected");
    button(output, "Connect Google").props.onClick();
    expect(onConnectGoogle).toHaveBeenCalledOnce();
  });

  it("shows the connected account and exposes sync and confirmed disconnect", () => {
    const onSyncGoogle = vi.fn();
    const onRequestGoogleDisconnect = vi.fn();
    const onDisconnectGoogle = vi.fn();
    const output = renderSection({
      googleConnection: {
        calendar_account_email: "calendar@example.com",
        last_synced_at: "2026-08-31T12:00:00.000Z",
        sync_status: "success",
      },
      googleSyncSummary: { calendarCount: 2, eventCount: 7 },
      onSyncGoogle,
      onRequestGoogleDisconnect,
    });

    expect(textContent(output)).toContain("calendar@example.com");
    expect(textContent(output)).toContain("Up to date");
    expect(textContent(output)).toContain("Latest result");
    expect(textContent(output)).toMatch(/2\s+calendars ·\s+7\s+events/);
    expect(
      textContent(find(output, (node) => props(node).className === "badge badge-success"))
    ).toBe("Connected");
    button(output, "Sync now").props.onClick();
    button(output, "Disconnect").props.onClick();
    expect(onSyncGoogle).toHaveBeenCalledOnce();
    expect(onRequestGoogleDisconnect).toHaveBeenCalledOnce();

    const confirming = renderSection({
      googleConnection: { calendar_account_email: "calendar@example.com" },
      confirmingGoogleDisconnect: true,
      onDisconnectGoogle,
    });
    const dialog = find(confirming, (node) => props(node).role === "alertdialog");

    expect(props(dialog)["aria-label"]).toBe("Disconnect Google Calendar?");
    button(dialog, "Disconnect").props.onClick();
    expect(onDisconnectGoogle).toHaveBeenCalledOnce();
  });

  it("retries a failed connection lookup and surfaces the sync error", () => {
    const onRetryGoogle = vi.fn();
    const output = renderSection({
      googleError: "Google Calendar connection status could not be loaded.",
      onRetryGoogle,
    });
    const alert = find(output, (node) => props(node).role === "alert");

    expect(textContent(alert)).toContain("could not be loaded");
    button(output, "Retry").props.onClick();
    expect(onRetryGoogle).toHaveBeenCalledOnce();
  });

  it("keeps the unavailable providers, their setup dialog, and disconnecting one", () => {
    const provider = CALENDAR_PROVIDERS[1];
    const onConnect = vi.fn();
    const onCloseSetup = vi.fn();
    const output = renderSection({
      selectedProvider: provider,
      setup: { missingVariables: ["VITE_MICROSOFT_CALENDAR_CLIENT_ID"] },
      onConnect,
      onCloseSetup,
    });
    const dialog = find(output, (node) => props(node).role === "dialog");

    expect(props(dialog)["aria-modal"]).toBe("true");
    expect(props(dialog)["aria-label"]).toBe(`Connect ${provider.name}`);
    expect(textContent(dialog)).toContain("VITE_MICROSOFT_CALENDAR_CLIENT_ID");
    expect(props(button(dialog, "Authorization unavailable")).disabled).toBe(true);
    button(output, "Set up").props.onClick();
    expect(onConnect).toHaveBeenCalledWith(provider.id);
    find(output, (node) => props(node)["aria-label"] === "Close").props.onClick();
    expect(onCloseSetup).toHaveBeenCalledOnce();

    const onDisconnect = vi.fn();
    const connected = renderSection({
      saving: true,
      settings: {
        ...DEFAULT_SETTINGS,
        calendarConnections: {
          ...DEFAULT_SETTINGS.calendarConnections,
          [provider.id]: {
            ...DEFAULT_SETTINGS.calendarConnections[provider.id],
            connected: true,
            accountLabel: "Connected account",
          },
        },
      },
      onDisconnect,
    });
    const disconnect = button(connected, "Disconnect");

    expect(props(disconnect).disabled).toBe(true);
    props(disconnect).onClick();
    expect(onDisconnect).toHaveBeenCalledWith(provider);
  });
});
