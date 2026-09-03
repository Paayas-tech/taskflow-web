import { SettingsGroup, SettingsRow, ToggleRow } from "./SettingsControls";

export function AccountSettingsSection({
  displayName,
  onOpenProfile,
  onOpenArchivedTasks,
  onExportData,
}) {
  return (
    <SettingsGroup title="Account">
      <SettingsRow
        label="Profile"
        value={displayName || "Account details"}
        onClick={onOpenProfile}
      />
      <SettingsRow label="Archived tasks" onClick={onOpenArchivedTasks} />
      <SettingsRow label="Export data" value="JSON" onClick={onExportData} />
    </SettingsGroup>
  );
}

export function ProjectsSettingsSection({
  defaultReminderTime,
  archivedProjectCount,
  onOpenProjectReminders,
  onOpenArchivedProjects,
  onOpenProjectCreate,
}) {
  return (
    <SettingsGroup title="Projects">
      <SettingsRow
        label="Project reminders"
        value={`${defaultReminderTime} min`}
        onClick={onOpenProjectReminders}
      />
      <SettingsRow
        label="Archived projects"
        value={String(archivedProjectCount)}
        onClick={onOpenArchivedProjects}
      />
      <SettingsRow label="New project" onClick={onOpenProjectCreate} />
    </SettingsGroup>
  );
}

export function PreferencesSettingsSection({
  myDayLabel,
  connectedCalendarCount,
  themeLabel,
  browserNotificationsEnabled,
  defaultViewLabel,
  timeSettingsLabel,
  languageLabel,
  onOpenMyDay,
  onOpenCalendars,
  onOpenTheme,
  onToggleBrowserNotifications,
  onOpenDefaultView,
  onOpenTimeSettings,
  onOpenLanguage,
}) {
  return (
    <SettingsGroup title="Preferences">
      <SettingsRow label="My day" value={myDayLabel} onClick={onOpenMyDay} />
      <SettingsRow
        label="Calendars"
        value={connectedCalendarCount ? `${connectedCalendarCount} connected` : "Not connected"}
        onClick={onOpenCalendars}
      />
      <SettingsRow label="Theme" value={themeLabel} onClick={onOpenTheme} />
      <ToggleRow
        label="Desktop notifications"
        description="Show reminders outside TaskFlow."
        checked={browserNotificationsEnabled}
        onChange={onToggleBrowserNotifications}
      />
      <SettingsRow label="Default view" value={defaultViewLabel} onClick={onOpenDefaultView} />
      <SettingsRow label="Time settings" value={timeSettingsLabel} onClick={onOpenTimeSettings} />
      <SettingsRow label="Language" value={languageLabel} onClick={onOpenLanguage} />
    </SettingsGroup>
  );
}

export function TaskflowSettingsSection({ onOpenShortcuts, onOpenAbout }) {
  return (
    <SettingsGroup title="TaskFlow">
      <SettingsRow label="Keyboard shortcuts" onClick={onOpenShortcuts} />
      <SettingsRow label="About" value="0.0.0" onClick={onOpenAbout} />
    </SettingsGroup>
  );
}
