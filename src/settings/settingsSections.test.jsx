import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settingsDomain";
import { CALENDAR_PROVIDERS } from "../domain/calendarConnectionDomain";
import CalendarConnectionSection from "./CalendarConnectionSection";
import ProfileSettingsPanel from "./ProfileSettingsPanel";
import SettingsSignOutSection from "./SettingsSignOutSection";
import {
  AccountSettingsSection,
  PreferencesSettingsSection,
  ProjectsSettingsSection,
  TaskflowSettingsSection,
} from "./SettingsOverviewSections";

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

function button(root, label) {
  return findElement(
    root,
    (node) => node.type === "button" && textContent(node).startsWith(label)
  );
}

describe("focused settings sections", () => {
  it("renders account navigation and forwards each account action", () => {
    const callbacks = {
      onOpenProfile: vi.fn(),
      onOpenIntegrations: vi.fn(),
      onOpenArchivedTasks: vi.fn(),
      onOpenImportData: vi.fn(),
    };
    const output = resolveNode(
      AccountSettingsSection({ displayName: "TaskFlow User", ...callbacks })
    );

    expect(textContent(findElement(output, (node) => node.type === "h2"))).toBe("account");
    expect(textContent(output)).toContain("TaskFlow User");
    button(output, "My Profile").props.onClick();
    button(output, "Integrations").props.onClick();
    button(output, "Archived Tasks").props.onClick();
    button(output, "Import Data").props.onClick();
    Object.values(callbacks).forEach((callback) => expect(callback).toHaveBeenCalledOnce());
  });

  it("renders project values and forwards reminder, archive, and create actions", () => {
    const onOpenProjectReminders = vi.fn();
    const onOpenArchivedProjects = vi.fn();
    const onOpenProjectCreate = vi.fn();
    const output = resolveNode(
      ProjectsSettingsSection({
        defaultReminderTime: 30,
        archivedProjectCount: 2,
        onOpenProjectReminders,
        onOpenArchivedProjects,
        onOpenProjectCreate,
      })
    );

    expect(textContent(output)).toContain("30 min");
    expect(textContent(output)).toContain("Archived Projects2");
    button(output, "Project Reminders").props.onClick();
    button(output, "Archived Projects").props.onClick();
    button(output, "Create a New Project").props.onClick();
    expect(onOpenProjectReminders).toHaveBeenCalledOnce();
    expect(onOpenArchivedProjects).toHaveBeenCalledOnce();
    expect(onOpenProjectCreate).toHaveBeenCalledOnce();
  });

  it("preserves preference labels, navigation callbacks, and notification payload", () => {
    const onOpenTheme = vi.fn();
    const onToggleBrowserNotifications = vi.fn();
    const output = resolveNode(
      PreferencesSettingsSection({
        myDayLabel: "Midnight",
        connectedCalendarCount: 1,
        themeLabel: "Dark",
        backgroundLabel: "Calm",
        browserNotificationsEnabled: true,
        defaultViewLabel: "Dashboard",
        defaultListLabel: "Inbox",
        timeSettingsLabel: "12 Hour · Monday",
        onOpenMyDay: vi.fn(),
        onOpenCalendars: vi.fn(),
        onOpenTheme,
        onOpenBackground: vi.fn(),
        onToggleBrowserNotifications,
        onOpenDefaultView: vi.fn(),
        onOpenDefaultList: vi.fn(),
        onOpenTimeSettings: vi.fn(),
        onOpenLanguage: vi.fn(),
      })
    );
    const notificationToggle = findElement(
      output,
      (node) => node.props?.type === "checkbox"
    );

    expect(textContent(output)).toContain("1 connected");
    expect(textContent(output)).toContain("Desktop NotificationsON");
    expect(notificationToggle.props.checked).toBe(true);
    button(output, "Theme").props.onClick();
    notificationToggle.props.onChange({ target: { checked: false } });
    expect(onOpenTheme).toHaveBeenCalledOnce();
    expect(onToggleBrowserNotifications).toHaveBeenCalledWith(false);
  });

  it("renders TaskFlow information navigation without changing copy", () => {
    const onOpenWhatsNew = vi.fn();
    const onOpenShortcuts = vi.fn();
    const onOpenSupport = vi.fn();
    const onOpenAbout = vi.fn();
    const output = resolveNode(
      TaskflowSettingsSection({
        onOpenWhatsNew,
        onOpenShortcuts,
        onOpenSupport,
        onOpenAbout,
      })
    );

    expect(textContent(output)).toContain("SupportNot available");
    expect(textContent(output)).toContain("About0.0.0");
    button(output, "What's New?").props.onClick();
    button(output, "Keyboard Shortcuts").props.onClick();
    button(output, "Support").props.onClick();
    button(output, "About").props.onClick();
    expect(onOpenWhatsNew).toHaveBeenCalledOnce();
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
    expect(onOpenSupport).toHaveBeenCalledOnce();
    expect(onOpenAbout).toHaveBeenCalledOnce();
  });

  it("preserves profile semantics, busy fields, and the full change payload", () => {
    const onChange = vi.fn();
    const onBack = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      profile: { displayName: "Current", email: "managed-account" },
    };
    const output = resolveNode(
      ProfileSettingsPanel({ settings, saving: true, onChange, onBack })
    );
    const inputs = findElements(output, (node) => node.type === "input");

    expect(textContent(output)).toContain("My Profile");
    expect(inputs[0].props.disabled).toBe(true);
    expect(inputs[1].props.readOnly).toBe(true);
    expect(button(output, "Saving...").props.disabled).toBe(true);
    inputs[0].props.onChange({ target: { value: "Updated" } });
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      profile: { ...settings.profile, displayName: "Updated" },
    });
    button(output, "←").props.onClick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("preserves calendar connect, disconnect, dialog, and busy contracts", () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onCloseSetup = vi.fn();
    const provider = CALENDAR_PROVIDERS[0];
    const settings = {
      ...DEFAULT_SETTINGS,
      calendarConnections: {
        ...DEFAULT_SETTINGS.calendarConnections,
        [provider.id]: {
          ...DEFAULT_SETTINGS.calendarConnections[provider.id],
          connected: true,
          accountLabel: "Connected account",
        },
      },
    };
    const output = resolveNode(
      CalendarConnectionSection({
        settings,
        saving: true,
        selectedProvider: provider,
        setup: { missingVariables: ["Provider configuration"] },
        dialogRef: { current: null },
        onBackdropMouseDown: vi.fn(),
        onBack: vi.fn(),
        onConnect,
        onDisconnect,
        onCloseSetup,
      })
    );
    const dialog = findElement(output, (node) => node.props?.role === "dialog");
    const disconnect = button(output, "Disconnect");

    expect(dialog.props["aria-modal"]).toBe("true");
    expect(textContent(output)).toContain(`Connect ${provider.name}`);
    expect(disconnect.props.disabled).toBe(true);
    disconnect.props.onClick();
    button(output, "Close").props.onClick();
    expect(onDisconnect).toHaveBeenCalledWith(provider);
    expect(onCloseSetup).toHaveBeenCalledOnce();

    const disconnectedOutput = resolveNode(
      CalendarConnectionSection({
        settings: DEFAULT_SETTINGS,
        saving: false,
        selectedProvider: null,
        setup: null,
        dialogRef: { current: null },
        onBackdropMouseDown: vi.fn(),
        onBack: vi.fn(),
        onConnect,
        onDisconnect,
        onCloseSetup,
      })
    );
    button(disconnectedOutput, "Connect").props.onClick();
    expect(onConnect).toHaveBeenCalledWith(CALENDAR_PROVIDERS[0].id);
  });

  it("preserves sign-out pending semantics, error ownership, and action", () => {
    const onSignOut = vi.fn();
    const output = resolveNode(
      SettingsSignOutSection({ onSignOut, pending: true, error: "Try again." })
    );
    const signOut = button(output, "Signing out...");
    const alert = findElement(output, (node) => node.props?.role === "alert");

    expect(signOut.props.disabled).toBe(true);
    expect(signOut.props["aria-busy"]).toBe(true);
    expect(signOut.props["aria-describedby"]).toBe(alert.props.id);
    expect(textContent(alert)).toBe("Try again.");
    signOut.props.onClick();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("shows a permanent-deletion warning before running account deletion", () => {
    const onDeleteAccount = vi.fn();
    const onCancelDelete = vi.fn();
    const output = resolveNode(
      SettingsSignOutSection({
        onSignOut: vi.fn(),
        onDeleteAccount,
        confirmingDelete: true,
        onCancelDelete,
      })
    );
    const deleteButton = button(output, "Permanently delete account");
    const dialog = findElement(output, (node) => node.props?.role === "alertdialog");

    expect(textContent(dialog)).toContain("All of your account data");
    expect(deleteButton.props.disabled).toBe(false);
    deleteButton.props.onClick();
    expect(onDeleteAccount).toHaveBeenCalledOnce();
    button(output, "Cancel").props.onClick();
    expect(onCancelDelete).toHaveBeenCalledOnce();
  });
});
