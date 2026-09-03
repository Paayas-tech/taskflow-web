import { useEffect, useMemo, useRef, useState } from "react";
import {
  SETTINGS_DATE_FORMATS,
  SETTINGS_DEFAULT_VIEWS,
  SETTINGS_TIME_FORMATS,
  SETTINGS_WEEK_STARTS,
  TASKFLOW_LANGUAGES,
  formatTimeForDisplay,
  getSettingsValidationError,
  myDayResetTime,
} from "./domain/settingsDomain";
import {
  CALENDAR_PROVIDERS,
  calendarProviderSetup,
  emptyCalendarConnection,
} from "./domain/calendarConnectionDomain";
import { requestNotificationPermission } from "./services/reminderService";
import { Avatar, Button, Field, Icon, InlineNotice, Input, Kbd, Spinner } from "./ui";
import {
  SelectionRows,
  SettingsDetail,
  SettingsRow,
} from "./settings/SettingsControls";
import {
  AccountSettingsSection,
  PreferencesSettingsSection,
  ProjectsSettingsSection,
  TaskflowSettingsSection,
} from "./settings/SettingsOverviewSections";
import ProfileSettingsPanel from "./settings/ProfileSettingsPanel";
import CalendarConnectionSection from "./settings/CalendarConnectionSection";
import ProjectRemindersPanel from "./settings/ProjectRemindersPanel";
import ArchivedProjectsPanel from "./settings/ArchivedProjectsPanel";
import { googleCalendarIntegrationService } from "./application/googleCalendarIntegrationService";

const updateSection = (settings, section, patch) => ({
  ...settings,
  [section]: { ...settings[section], ...patch },
});

/** "early-morning" → "Early morning". */
const humanize = (value) => {
  const text = String(value || "").replace(/-/g, " ");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
};

const panelTitles = {
  profile: "Profile",
  projectReminders: "Project reminders",
  archivedProjects: "Archived projects",
  myDay: "My day",
  calendars: "Calendars",
  theme: "Theme",
  defaultView: "Default view",
  timeSettings: "Time settings",
  timeFormat: "Time format",
  dateFormat: "Date format",
  weekStart: "Week starts on",
  language: "Language",
  shortcuts: "Keyboard shortcuts",
  about: "About",
};

const defaultViewOptions = [
  ["dashboard", "Home", "Start on the home view"],
  ["tasks", "My tasks", "Start on your task list"],
  ["projects", "Projects", "Start on the project list"],
  ["calendar", "Calendar", "Start on the calendar"],
  ["last-viewed", "Last viewed", "Continue where you left off"],
].filter(([value]) => SETTINGS_DEFAULT_VIEWS.includes(value));

const shortcuts = [
  ["Open search", ["⌘K", "/"]],
  ["Close a dialog or panel", ["Esc"]],
  ["Move through controls", ["Tab"]],
];

export function SettingsPage({
  settings,
  loading,
  error,
  saving,
  saveMessage,
  onRetry,
  onChange,
  onSave,
  onCommit,
  onSignOut,
  signOutPending = false,
  signOutError = "",
  onDeleteAccount,
  deleteAccountPending = false,
  deleteAccountError = "",
  onNavigate,
  profileRequest = 0,
  onOpenProjectCreate,
  onRestoreProject,
  exportData,
  onGoogleEventsChange,
}) {
  const callbackParameters = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get("integration") === "google" ? parameters : null;
  }, []);
  const googleCallbackError = callbackParameters?.get("reason") === "authorization_denied"
    ? "Google Calendar access was cancelled. Nothing was connected."
    : callbackParameters?.get("reason") === "invalid_or_expired_state"
      ? "This Google connection request expired. Please start again."
      : "Google Calendar could not be connected. Please try again.";
  const [panelStack, setPanelStack] = useState(() => callbackParameters ? ["calendars"] : []);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [panelMessage, setPanelMessage] = useState("");
  const [projectActionId, setProjectActionId] = useState("");
  const [confirmingAccountDelete, setConfirmingAccountDelete] = useState(false);
  const [calendarSetupProviderId, setCalendarSetupProviderId] = useState("");
  const [googleConnection, setGoogleConnection] = useState(null);
  const [googleConnectionLoading, setGoogleConnectionLoading] = useState(false);
  const [googlePendingAction, setGooglePendingAction] = useState("");
  const [googleIntegrationError, setGoogleIntegrationError] = useState(() =>
    callbackParameters?.get("google_calendar") === "error"
      ? googleCallbackError
      : ""
  );
  const [googleIntegrationMessage, setGoogleIntegrationMessage] = useState(() =>
    callbackParameters?.get("google_calendar") === "connected"
      ? "Google Calendar connected."
      : ""
  );
  const [googleSyncSummary, setGoogleSyncSummary] = useState(null);
  const [confirmingGoogleDisconnect, setConfirmingGoogleDisconnect] = useState(false);
  const googleCallbackSyncStartedRef = useRef(false);
  const validationError = useMemo(
    () => getSettingsValidationError(settings),
    [settings]
  );
  const activePanel = panelStack.at(-1) || null;
  const projects = exportData?.projects || [];
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const languageLabel =
    TASKFLOW_LANGUAGES.find(({ code }) => code === settings.language.code)?.name ||
    "English";
  const defaultViewLabel =
    defaultViewOptions.find(([value]) => value === settings.navigation.defaultView)?.[1] || "Home";
  const weekStartLabel = humanize(settings.time.weekStartsOn);
  const timeFormatLabel = settings.time.format === "12-hour" ? "12 hour" : "24 hour";
  const connectedCalendarCount =
    CALENDAR_PROVIDERS.filter(
      ({ id }) => id !== "google" && settings.calendarConnections[id]?.connected
    ).length + (googleConnection ? 1 : 0);
  const selectedCalendarProvider = CALENDAR_PROVIDERS.find(
    ({ id }) => id === calendarSetupProviderId
  );

  useEffect(() => {
    if (!profileRequest) return;
    setPanelMessage("");
    setPanelStack(["profile"]);
  }, [profileRequest]);

  const loadGoogleConnection = async () => {
    setGoogleConnectionLoading(true);
    try {
      const connection = await googleCalendarIntegrationService.getConnection();
      setGoogleConnection(connection);
      setGoogleIntegrationError("");
    } catch (connectionError) {
      console.error("Error loading Google Calendar connection:", connectionError);
      setGoogleIntegrationError("Google Calendar connection status could not be loaded.");
    } finally {
      setGoogleConnectionLoading(false);
    }
  };

  useEffect(() => {
    if (activePanel !== "calendars") return;
    void loadGoogleConnection();
  }, [activePanel]);

  useEffect(() => {
    if (!callbackParameters || typeof window === "undefined") return;
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history?.replaceState?.({}, "", cleanUrl);
  }, [callbackParameters]);

  const openPanel = (panel) => {
    setPanelMessage("");
    setPanelStack((stack) => [...stack, panel]);
  };
  const closePanel = () => {
    setPanelMessage("");
    setPanelStack((stack) => stack.slice(0, -1));
  };

  const commitSettings = async (nextSettings, message = "Setting saved.") => {
    onChange(nextSettings);
    setPanelMessage("");
    try {
      await onCommit(nextSettings);
      setPanelMessage(message);
    } catch {
      // App-level error feedback already provides the actionable failure state.
    }
  };

  const commitSection = (section, patch, message) =>
    commitSettings(updateSection(settings, section, patch), message);

  const disconnectCalendar = (provider) => {
    const nextConnections = {
      ...settings.calendarConnections,
      [provider.id]: emptyCalendarConnection(),
    };
    return commitSection(
      "calendarConnections",
      nextConnections,
      `${provider.name} disconnected.`
    );
  };

  const connectGoogleCalendar = async () => {
    setGooglePendingAction("connect");
    setGoogleIntegrationError("");
    setGoogleIntegrationMessage("");
    try {
      const authorizationUrl = await googleCalendarIntegrationService.startOAuth();
      window.location.assign(authorizationUrl);
    } catch (connectionError) {
      setGoogleIntegrationError(connectionError?.message || "Google Calendar connection could not be started.");
      setGooglePendingAction("");
    }
  };

  const syncGoogleCalendar = async () => {
    setGooglePendingAction("sync");
    setGoogleIntegrationError("");
    setGoogleIntegrationMessage("");
    try {
      const result = await googleCalendarIntegrationService.sync();
      onGoogleEventsChange?.(Array.isArray(result.events) ? result.events : []);
      setGoogleSyncSummary({
        calendarCount: result.calendars?.length || 0,
        eventCount: result.events?.length || 0,
      });
      setGoogleConnection((connection) => connection ? {
        ...connection,
        last_synced_at: result.lastSyncedAt,
        sync_status: "success",
        sync_error: null,
      } : connection);
      setGoogleIntegrationMessage("Google Calendar synced.");
    } catch (syncError) {
      setGoogleIntegrationError(syncError?.message || "Google Calendar could not be synced.");
    } finally {
      setGooglePendingAction("");
    }
  };

  const disconnectGoogleCalendar = async () => {
    setGooglePendingAction("disconnect");
    setGoogleIntegrationError("");
    setGoogleIntegrationMessage("");
    try {
      await googleCalendarIntegrationService.disconnect();
      onGoogleEventsChange?.([]);
      setGoogleConnection(null);
      setGoogleSyncSummary(null);
      setConfirmingGoogleDisconnect(false);
      setGoogleIntegrationMessage("Google Calendar disconnected.");
    } catch (disconnectError) {
      setGoogleIntegrationError(disconnectError?.message || "Google Calendar could not be disconnected.");
    } finally {
      setGooglePendingAction("");
    }
  };

  useEffect(() => {
    if (
      activePanel !== "calendars" ||
      callbackParameters?.get("google_calendar") !== "connected" ||
      googleCallbackSyncStartedRef.current
    ) return;
    googleCallbackSyncStartedRef.current = true;
    void (async () => {
      setGooglePendingAction("sync");
      setGoogleIntegrationError("");
      try {
        const result = await googleCalendarIntegrationService.sync();
        onGoogleEventsChange?.(Array.isArray(result.events) ? result.events : []);
        setGoogleSyncSummary({
          calendarCount: result.calendars?.length || 0,
          eventCount: result.events?.length || 0,
        });
        setGoogleConnection((connection) => connection ? {
          ...connection,
          last_synced_at: result.lastSyncedAt,
          sync_status: "success",
          sync_error: null,
        } : connection);
        setGoogleIntegrationMessage("Google Calendar connected and synced.");
      } catch (syncError) {
        setGoogleIntegrationError(syncError?.message || "Google Calendar connected, but events could not be synced.");
      } finally {
        setGooglePendingAction("");
      }
    })();
  }, [activePanel, callbackParameters, onGoogleEventsChange]);

  const enableBrowserNotifications = async (enabled) => {
    setNotificationMessage("");
    if (!enabled) {
      await commitSection(
        "reminder",
        { enableBrowserNotifications: false },
        "Desktop notifications disabled."
      );
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      await commitSection(
        "reminder",
        { enableBrowserNotifications: false },
        "Browser permission is required."
      );
      setNotificationMessage(
        permission === "denied"
          ? "TaskFlow notifications remain off because browser permission is blocked."
          : "Desktop notifications are unavailable in this browser."
      );
      return;
    }

    await commitSection(
      "reminder",
      { enableBrowserNotifications: true },
      "Desktop notifications enabled."
    );
    setNotificationMessage("TaskFlow notifications are enabled and browser permission is granted.");
  };

  const downloadExport = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const restoreArchivedProject = async (project) => {
    setPanelMessage("");
    setProjectActionId(project.id);
    try {
      await onRestoreProject(project.id);
      setPanelMessage(`${project.name} restored.`);
    } catch (restoreError) {
      console.error("Error restoring archived project:", restoreError);
      setPanelMessage(`We couldn't restore ${project.name}. Try again.`);
    } finally {
      setProjectActionId("");
    }
  };

  if (loading) {
    return (
      <section className="page settings-page" aria-label="Settings">
        <header className="page-header">
          <h1 className="page-title">Settings</h1>
        </header>
        <div className="page-body is-narrow">
          <p className="settings-loading" role="status">
            <Spinner aria-hidden="true" />
            Loading settings…
          </p>
        </div>
      </section>
    );
  }

  // A display-name problem belongs on its own field; anything else stays a page notice.
  const displayNameError =
    activePanel === "profile" && validationError.startsWith("Display name")
      ? validationError
      : "";

  const renderPanel = () => {
    if (activePanel === "profile") {
      return (
        <ProfileSettingsPanel
          settings={settings}
          saving={saving}
          error={displayNameError}
          onChange={onChange}
          onSave={() => {
            if (!validationError) onSave(settings);
          }}
          onSignOut={onSignOut}
          signOutPending={signOutPending}
          signOutError={signOutError}
          onDeleteAccount={onDeleteAccount}
          deleteAccountPending={deleteAccountPending}
          deleteAccountError={deleteAccountError}
          confirmingDelete={confirmingAccountDelete}
          onBeginDelete={() => setConfirmingAccountDelete(true)}
          onCancelDelete={() => {
            if (deleteAccountPending) return;
            setConfirmingAccountDelete(false);
          }}
        />
      );
    }

    if (activePanel === "myDay") {
      return (
        <SettingsDetail title="My day" description="Set when your day resets.">
          <SelectionRows
            ariaLabel="My day reset time"
            value={settings.myDay.resetMode}
            onSelect={(resetMode) =>
              commitSection(
                "myDay",
                {
                  resetMode,
                  customResetTime:
                    resetMode === "midnight"
                      ? "00:00"
                      : resetMode === "early-morning"
                        ? "06:00"
                        : settings.myDay.customResetTime,
                },
                "My day reset time saved."
              )
            }
            options={[
              ["midnight", "Midnight", "Reset at 12:00 AM"],
              ["early-morning", "Early morning", "Reset at 6:00 AM"],
              ["custom", "Custom time", "Choose a local reset time"],
            ]}
          />
          {settings.myDay.resetMode === "custom" ? (
            <Field label="Custom reset time" htmlFor="settings-custom-reset-time" inline>
              <Input
                id="settings-custom-reset-time"
                className="settings-time-input"
                type="time"
                value={settings.myDay.customResetTime}
                onChange={(event) =>
                  void commitSection(
                    "myDay",
                    { customResetTime: event.target.value },
                    "Custom reset time saved."
                  )
                }
              />
            </Field>
          ) : null}
        </SettingsDetail>
      );
    }

    if (activePanel === "calendars") {
      const setup = selectedCalendarProvider
        ? calendarProviderSetup(selectedCalendarProvider, import.meta.env)
        : null;
      return (
        <CalendarConnectionSection
          settings={settings}
          saving={saving}
          googleConnection={googleConnection}
          googleLoading={googleConnectionLoading}
          googlePendingAction={googlePendingAction}
          googleError={googleIntegrationError}
          googleMessage={googleIntegrationMessage}
          googleSyncSummary={googleSyncSummary}
          confirmingGoogleDisconnect={confirmingGoogleDisconnect}
          selectedProvider={selectedCalendarProvider}
          setup={setup}
          onConnect={setCalendarSetupProviderId}
          onDisconnect={(provider) => void disconnectCalendar(provider)}
          onConnectGoogle={() => void connectGoogleCalendar()}
          onSyncGoogle={() => void syncGoogleCalendar()}
          onRequestGoogleDisconnect={() => setConfirmingGoogleDisconnect(true)}
          onCancelGoogleDisconnect={() => setConfirmingGoogleDisconnect(false)}
          onDisconnectGoogle={() => void disconnectGoogleCalendar()}
          onRetryGoogle={() => void loadGoogleConnection()}
          onCloseSetup={() => setCalendarSetupProviderId("")}
        />
      );
    }

    if (activePanel === "theme") {
      return (
        <SettingsDetail title="Theme" description="Choose your appearance.">
          <SelectionRows
            ariaLabel="Theme"
            value={settings.theme.mode}
            onSelect={(mode) => commitSection("theme", { mode }, "Theme saved.")}
            options={[
              ["light", "Light", "Always use the light theme"],
              ["dark", "Dark", "Always use the dark theme"],
            ]}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "defaultView") {
      return (
        <SettingsDetail title="Default view" description="Choose your start page.">
          <SelectionRows
            ariaLabel="Default view"
            value={settings.navigation.defaultView}
            onSelect={(defaultView) =>
              commitSection("navigation", { defaultView }, "Default view saved.")
            }
            options={defaultViewOptions}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "timeSettings") {
      return (
        <SettingsDetail title="Time settings" description="Set date and time formats.">
          <div className="row-list">
            <SettingsRow
              label="Time format"
              value={timeFormatLabel}
              onClick={() => openPanel("timeFormat")}
            />
            <SettingsRow
              label="Date format"
              value={settings.time.dateFormat}
              onClick={() => openPanel("dateFormat")}
            />
            <SettingsRow
              label="Week starts on"
              value={weekStartLabel}
              onClick={() => openPanel("weekStart")}
            />
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "timeFormat") {
      return (
        <SettingsDetail title="Time format">
          <SelectionRows
            ariaLabel="Time format"
            value={settings.time.format}
            onSelect={(format) => commitSection("time", { format }, "Time format saved.")}
            options={SETTINGS_TIME_FORMATS.map((format) => [
              format,
              format === "12-hour" ? "12 hour" : "24 hour",
            ])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "dateFormat") {
      return (
        <SettingsDetail title="Date format">
          <SelectionRows
            ariaLabel="Date format"
            value={settings.time.dateFormat}
            onSelect={(dateFormat) => commitSection("time", { dateFormat }, "Date format saved.")}
            options={SETTINGS_DATE_FORMATS.map((format) => [format, format])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "weekStart") {
      return (
        <SettingsDetail title="Week starts on">
          <SelectionRows
            ariaLabel="First day of week"
            value={settings.time.weekStartsOn}
            onSelect={(weekStartsOn) =>
              commitSection("time", { weekStartsOn }, "Calendar week start saved.")
            }
            options={SETTINGS_WEEK_STARTS.map((day) => [day, humanize(day)])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "language") {
      return (
        <SettingsDetail
          title="Language"
          description="Choose your locale. Interface text remains English."
        >
          <SelectionRows
            ariaLabel="Language"
            value={settings.language.code}
            onSelect={(code) => commitSection("language", { code }, "Language preference saved.")}
            options={TASKFLOW_LANGUAGES.map(({ code, name, locale }) => [
              code,
              name,
              `${locale} locale`,
            ])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "projectReminders") {
      return (
        <ProjectRemindersPanel
          reminder={settings.reminder}
          onDefaultTimeChange={(defaultTime) =>
            onChange(updateSection(settings, "reminder", { defaultTime }))
          }
          onDefaultTimeCommit={(defaultTime) =>
            void commitSection("reminder", { defaultTime }, "")
          }
          onInAppRemindersChange={(enableInAppReminders) =>
            void commitSection("reminder", { enableInAppReminders }, "")
          }
          onSoundChange={(enableSound) =>
            void commitSection("reminder", { enableSound }, "")
          }
        />
      );
    }

    if (activePanel === "archivedProjects") {
      return (
        <ArchivedProjectsPanel
          projects={archivedProjects}
          pendingProjectId={projectActionId}
          onViewProject={(project) =>
            onNavigate?.(`/projects/${encodeURIComponent(project.id)}`)
          }
          onRestoreProject={(project) => void restoreArchivedProject(project)}
        />
      );
    }

    if (activePanel === "shortcuts") {
      return (
        <SettingsDetail title="Keyboard shortcuts" description="Available keyboard actions.">
          <div className="row-list">
            {shortcuts.map(([action, keys]) => (
              <p className="settings-shortcut-row" key={action}>
                <span>{action}</span>
                <span className="cluster-2">
                  {keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </p>
            ))}
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "about") {
      return (
        <SettingsDetail title="About" description="Application information.">
          <div className="settings-about">
            <p className="settings-about-name">TaskFlow</p>
            <p className="muted">Version 0.0.0</p>
            <p className="muted">React, Vite, and Supabase productivity application.</p>
            <p className="muted">No verified terms or privacy links are configured.</p>
          </div>
        </SettingsDetail>
      );
    }

    return null;
  };

  const feedbackMessage =
    activePanel === "projectReminders"
      ? ""
      : notificationMessage || panelMessage || saveMessage;

  return (
    <section className="page settings-page" aria-label="Settings">
      <header className="page-header">
        {activePanel ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="arrow-left" />}
            onClick={closePanel}
          >
            Back
          </Button>
        ) : null}
        <h1 className="page-title">{activePanel ? panelTitles[activePanel] : "Settings"}</h1>
      </header>

      <div className="page-body is-narrow">
        {error ? (
          <InlineNotice
            tone="error"
            className="page-notice"
            action={
              <Button size="sm" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            {error}
          </InlineNotice>
        ) : null}

        {validationError && !displayNameError ? (
          <InlineNotice tone="error" className="page-notice">
            {validationError}
          </InlineNotice>
        ) : null}

        {feedbackMessage ? (
          <InlineNotice tone="success" className="page-notice">
            {feedbackMessage}
          </InlineNotice>
        ) : null}

        {activePanel ? (
          renderPanel()
        ) : (
          <div className="settings-overview">
            <header className="settings-account">
              <Avatar name={settings.profile.displayName || settings.profile.email} size="lg" />
              <div className="settings-account-body">
                <span className="settings-account-name">
                  {settings.profile.displayName || "TaskFlow user"}
                </span>
                <span className="settings-account-email">{settings.profile.email}</span>
              </div>
            </header>

            <AccountSettingsSection
              displayName={settings.profile.displayName}
              onOpenProfile={() => openPanel("profile")}
              onOpenArchivedTasks={() => onNavigate?.("/archived-tasks")}
              onExportData={downloadExport}
            />
            <ProjectsSettingsSection
              defaultReminderTime={settings.reminder.defaultTime}
              archivedProjectCount={archivedProjects.length}
              onOpenProjectReminders={() => openPanel("projectReminders")}
              onOpenArchivedProjects={() => openPanel("archivedProjects")}
              onOpenProjectCreate={onOpenProjectCreate}
            />
            <PreferencesSettingsSection
              myDayLabel={formatTimeForDisplay(
                myDayResetTime(settings.myDay),
                settings.time.format
              )}
              connectedCalendarCount={connectedCalendarCount}
              themeLabel={humanize(settings.theme.mode)}
              browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
              defaultViewLabel={defaultViewLabel}
              timeSettingsLabel={`${timeFormatLabel} · ${weekStartLabel}`}
              languageLabel={languageLabel}
              onOpenMyDay={() => openPanel("myDay")}
              onOpenCalendars={() => openPanel("calendars")}
              onOpenTheme={() => openPanel("theme")}
              onToggleBrowserNotifications={(enabled) => void enableBrowserNotifications(enabled)}
              onOpenDefaultView={() => openPanel("defaultView")}
              onOpenTimeSettings={() => openPanel("timeSettings")}
              onOpenLanguage={() => openPanel("language")}
            />
            <TaskflowSettingsSection
              onOpenShortcuts={() => openPanel("shortcuts")}
              onOpenAbout={() => openPanel("about")}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default SettingsPage;
