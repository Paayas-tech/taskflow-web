import { SettingsGroup, SettingsRow, ToggleRow } from "./SettingsControls";

export function AccountSettingsSection({
  displayName,
  onOpenProfile,
  onOpenArchivedTasks,
  onOpenImportData,
}) {
  return (
    <SettingsGroup title="account">
      <SettingsRow label="My Profile" value={displayName || "Account details"} onClick={onOpenProfile} />
      <SettingsRow label="Archived Tasks" onClick={onOpenArchivedTasks} />
      <SettingsRow label="Import Data" value="Not available" onClick={onOpenImportData} />
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
    <SettingsGroup title="projects">
      <SettingsRow label="Project Reminders" value={`${defaultReminderTime} min`} onClick={onOpenProjectReminders} />
      <SettingsRow label="Archived Projects" value={String(archivedProjectCount)} onClick={onOpenArchivedProjects} />
      <SettingsRow label="Create a New Project" onClick={onOpenProjectCreate} />
    </SettingsGroup>
  );
}

export function PreferencesSettingsSection({
  myDayLabel,
  connectedCalendarCount,
  themeLabel,
  backgroundLabel,
  browserNotificationsEnabled,
  defaultViewLabel,
  defaultListLabel,
  timeSettingsLabel,
  languageLabel,
  onOpenMyDay,
  onOpenCalendars,
  onOpenTheme,
  onOpenBackground,
  onToggleBrowserNotifications,
  onOpenDefaultView,
  onOpenDefaultList,
  onOpenTimeSettings,
  onOpenLanguage,
}) {
  return (
    <SettingsGroup title="preferences">
      <SettingsRow label="My Day" value={myDayLabel} onClick={onOpenMyDay} />
      <SettingsRow
        label="Calendars"
        value={connectedCalendarCount ? `${connectedCalendarCount} connected` : "Not connected"}
        onClick={onOpenCalendars}
      />
      <SettingsRow label="Theme" value={themeLabel} onClick={onOpenTheme} />
      <SettingsRow label="Background" value={backgroundLabel} onClick={onOpenBackground} />
      <ToggleRow
        label="Desktop Notifications"
        checked={browserNotificationsEnabled}
        onChange={onToggleBrowserNotifications}
        status={browserNotificationsEnabled ? "ON" : "OFF"}
      />
      <SettingsRow label="Default View" value={defaultViewLabel} onClick={onOpenDefaultView} />
      <SettingsRow label="Default List" value={defaultListLabel} onClick={onOpenDefaultList} />
      <SettingsRow label="Time Settings" value={timeSettingsLabel} onClick={onOpenTimeSettings} />
      <SettingsRow label="Language" value={languageLabel} onClick={onOpenLanguage} />
    </SettingsGroup>
  );
}

export function TaskflowSettingsSection({
  onOpenWhatsNew,
  onOpenShortcuts,
  onOpenAbout,
}) {
  return (
    <SettingsGroup title="taskflow">
      <SettingsRow label="What's New?" onClick={onOpenWhatsNew} />
      <SettingsRow label="Keyboard Shortcuts" onClick={onOpenShortcuts} />
      <SettingsRow label="About" value="0.0.0" onClick={onOpenAbout} />
    </SettingsGroup>
  );
}
