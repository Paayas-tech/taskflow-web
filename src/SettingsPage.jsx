import { useEffect, useMemo, useRef, useState } from "react";
import {
  SETTINGS_DATE_FORMATS,
  SETTINGS_DEFAULT_VIEWS,
  SETTINGS_TIME_FORMATS,
  SETTINGS_WEEK_STARTS,
  TASKFLOW_BACKGROUNDS,
  TASKFLOW_LANGUAGES,
  getSettingsValidationError,
} from "./domain/settingsDomain";
import {
  CALENDAR_PROVIDERS,
  calendarProviderSetup,
  emptyCalendarConnection,
} from "./domain/calendarConnectionDomain";
import { requestNotificationPermission } from "./services/reminderService";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";
import {
  PlaceholderPanel,
  SelectionRows,
  SettingsDetail,
  SettingsRow,
  ToggleRow,
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
import BackgroundSettingsPanel from "./settings/BackgroundSettingsPanel";
import ArchivedProjectsPanel from "./settings/ArchivedProjectsPanel";
import GoogleCalendarIntegrationPanel from "./settings/GoogleCalendarIntegrationPanel";
import { googleCalendarIntegrationService } from "./application/googleCalendarIntegrationService";

const updateSection = (settings, section, patch) => ({
  ...settings,
  [section]: { ...settings[section], ...patch },
});

const titleCase = (value) =>
  String(value || "")
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

const defaultViewOptions = [
  ["dashboard", "Dashboard"],
  ["tasks", "All Tasks"],
  ["projects", "Projects"],
  ["calendar", "Calendar"],
  ["last-viewed", "Last Viewed"],
].filter(([value]) => SETTINGS_DEFAULT_VIEWS.includes(value));

export default function SettingsPage({
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
  homeRequest = 0,
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
  const [backgroundSearch, setBackgroundSearch] = useState("");
  const [confirmingFilterReset, setConfirmingFilterReset] = useState(false);
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
  const calendarDialogRef = useRef(null);
  const validationError = useMemo(
    () => getSettingsValidationError(settings),
    [settings]
  );
  const activePanel = panelStack.at(-1) || null;
  const projects = exportData?.projects || [];
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const customLists = exportData?.lists || [];
  const selectedList = customLists.find(
    (list) => list.id === settings.taskDefaults.listId
  );
  const themeLabel = titleCase(settings.theme.mode);
  const backgroundLabel =
    TASKFLOW_BACKGROUNDS.find(
      ({ id }) => id === settings.background.selected
    )?.name || "Calm";
  const languageLabel =
    TASKFLOW_LANGUAGES.find(({ code }) => code === settings.language.code)?.name ||
    "English";
  const defaultViewLabel =
    defaultViewOptions.find(([value]) => value === settings.navigation.defaultView)?.[1] || "Dashboard";
  const weekStartLabel = titleCase(settings.time.weekStartsOn);
  const connectedCalendarCount = CALENDAR_PROVIDERS.filter(
    ({ id }) => settings.calendarConnections[id]?.connected
  ).length;
  const selectedCalendarProvider = CALENDAR_PROVIDERS.find(
    ({ id }) => id === calendarSetupProviderId
  );

  const { onBackdropMouseDown: onCalendarBackdropMouseDown } =
    useModalLifecycle({
      isOpen: Boolean(calendarSetupProviderId),
      modalRef: calendarDialogRef,
      onClose: () => setCalendarSetupProviderId(""),
      trapFocus: false,
      restoreFocus: false,
    });

  useEffect(() => {
    if (!profileRequest) return;
    setPanelMessage("");
    setPanelStack(["profile"]);
  }, [profileRequest]);

  useEffect(() => {
    if (!homeRequest) return;
    setPanelMessage("");
    setPanelStack([]);
  }, [homeRequest]);

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
    if (activePanel !== "integrations" && activePanel !== "calendars") return;
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
      <section className="settings-state" aria-live="polite">
        <span className="settings-spinner" aria-hidden="true" />
        <h2>Loading settings</h2>
        <p>Preparing your preferences.</p>
      </section>
    );
  }

  const renderPanel = () => {
    if (activePanel === "profile") {
      return (
        <ProfileSettingsPanel
          settings={settings}
          saving={saving}
          onChange={onChange}
          onBack={closePanel}
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

    if (activePanel === "integrations") {
      return (
        <GoogleCalendarIntegrationPanel
          connection={googleConnection}
          loading={googleConnectionLoading}
          pendingAction={googlePendingAction}
          error={googleIntegrationError}
          message={googleIntegrationMessage}
          syncSummary={googleSyncSummary}
          onBack={closePanel}
          onConnect={() => void connectGoogleCalendar()}
          onSync={() => void syncGoogleCalendar()}
          onDisconnect={() => void disconnectGoogleCalendar()}
          onRetry={() => void loadGoogleConnection()}
        />
      );
    }

    if (activePanel === "myDay") {
      const resetLabel =
        settings.myDay.resetMode === "early-morning"
          ? "6:00 AM"
          : settings.myDay.resetMode === "custom"
            ? settings.myDay.customResetTime
            : "Midnight";
      return (
        <SettingsDetail title="My Day" description="Control the daily boundary used by Today." onBack={closePanel}>
          <div className="settings-compact-list">
            <SettingsRow label="Reset Time" value={resetLabel} onClick={() => openPanel("myDayReset")} />
            <SettingsRow label="External Suggestions" value="Not available" onClick={() => openPanel("externalSuggestions")} />
            <SettingsRow label="Reset Filter Suggestions" onClick={() => setConfirmingFilterReset(true)} />
          </div>
          {confirmingFilterReset && (
            <div className="settings-inline-confirm" role="alertdialog" aria-label="Reset filter suggestions">
              <p>TaskFlow does not currently store My Day filter suggestions. Confirm to clear any future-compatible local value.</p>
              <div>
                <button className="ghost-btn" type="button" onClick={() => setConfirmingFilterReset(false)}>Cancel</button>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => {
                    setConfirmingFilterReset(false);
                    setPanelMessage("No saved filter suggestions were present.");
                  }}
                >
                  Confirm reset
                </button>
              </div>
            </div>
          )}
        </SettingsDetail>
      );
    }

    if (activePanel === "myDayReset") {
      return (
        <SettingsDetail title="Reset Time" description="Today uses this local-time boundary." onBack={closePanel}>
          <SelectionRows
            ariaLabel="My Day reset time"
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
                "My Day reset time saved."
              )
            }
            options={[
              ["midnight", "Midnight", "Reset at 12:00 AM"],
              ["early-morning", "Early morning", "Reset at 6:00 AM"],
              ["custom", "Custom time", "Choose a local reset time"],
            ]}
          />
          {settings.myDay.resetMode === "custom" && (
            <label className="settings-inline-field">
              <span>Custom reset time</span>
              <input
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
            </label>
          )}
        </SettingsDetail>
      );
    }

    if (activePanel === "externalSuggestions") {
      return (
        <PlaceholderPanel
          title="External Suggestions"
          description="External task sources require reviewed integrations that TaskFlow does not have yet."
          onBack={closePanel}
        >
          <ToggleRow
            label="Use external suggestions"
            description="Unavailable until an integration is connected."
            checked={false}
            disabled
            status="Not available"
          />
        </PlaceholderPanel>
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
          selectedProvider={selectedCalendarProvider}
          setup={setup}
          dialogRef={calendarDialogRef}
          onBackdropMouseDown={onCalendarBackdropMouseDown}
          onBack={closePanel}
          onConnect={setCalendarSetupProviderId}
          onDisconnect={(provider) => void disconnectCalendar(provider)}
          onConnectGoogle={() => void connectGoogleCalendar()}
          onSyncGoogle={() => void syncGoogleCalendar()}
          onDisconnectGoogle={() => void disconnectGoogleCalendar()}
          confirmingGoogleDisconnect={confirmingGoogleDisconnect}
          onRequestGoogleDisconnect={() => setConfirmingGoogleDisconnect(true)}
          onCancelGoogleDisconnect={() => setConfirmingGoogleDisconnect(false)}
          onRetryGoogle={() => void loadGoogleConnection()}
          onCloseSetup={() => setCalendarSetupProviderId("")}
        />
      );
    }

    if (activePanel === "theme") {
      return (
        <SettingsDetail title="Theme" description="Selection applies and saves immediately." onBack={closePanel}>
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

    if (activePanel === "background") {
      return (
        <BackgroundSettingsPanel
          backgrounds={TASKFLOW_BACKGROUNDS}
          selectedBackgroundId={settings.background.selected}
          searchValue={backgroundSearch}
          onSearchChange={setBackgroundSearch}
          onBack={closePanel}
          onSelectBackground={({ id, name }) =>
            void commitSettings(
              {
                ...settings,
                background: { selected: id },
                appearance: { ...settings.appearance, background: id },
              },
              `${name} background saved.`
            )
          }
        />
      );
    }

    if (activePanel === "defaultView") {
      return (
        <SettingsDetail title="Default View" description="Used when TaskFlow opens at its root URL." onBack={closePanel}>
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

    if (activePanel === "defaultList") {
      const options = [
        ["", "Inbox", "Tasks without a custom list"],
        ...customLists.map((list) => [list.id, list.name, "Custom list"]),
      ];
      return (
        <SettingsDetail title="Default List" description="Preselected for newly created tasks." onBack={closePanel}>
          <SelectionRows
            ariaLabel="Default list"
            value={settings.taskDefaults.listId || ""}
            onSelect={(listId) =>
              commitSection("taskDefaults", { listId: listId || null }, "Default list saved.")
            }
            options={options}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "timeSettings") {
      return (
        <SettingsDetail title="Time Settings" description="Formatting applies to TaskFlow task and Calendar metadata." onBack={closePanel}>
          <div className="settings-compact-list">
            <SettingsRow label="Time Format" value={settings.time.format === "12-hour" ? "12 Hour" : "24 Hour"} onClick={() => openPanel("timeFormat")} />
            <SettingsRow label="Date Settings" value={settings.time.dateFormat} onClick={() => openPanel("dateFormat")} />
            <SettingsRow label="Week Starts On" value={weekStartLabel} onClick={() => openPanel("weekStart")} />
            <ToggleRow
              label="Time Detection"
              description="Natural-language time detection is not implemented."
              checked={false}
              disabled
              status="Not available"
            />
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "timeFormat") {
      return (
        <SettingsDetail title="Time Format" onBack={closePanel}>
          <SelectionRows
            ariaLabel="Time format"
            value={settings.time.format}
            onSelect={(format) => commitSection("time", { format }, "Time format saved.")}
            options={SETTINGS_TIME_FORMATS.map((format) => [
              format,
              format === "12-hour" ? "12 Hour" : "24 Hour",
            ])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "dateFormat") {
      return (
        <SettingsDetail title="Date Settings" onBack={closePanel}>
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
        <SettingsDetail title="Week Starts On" onBack={closePanel}>
          <SelectionRows
            ariaLabel="First day of week"
            value={settings.time.weekStartsOn}
            onSelect={(weekStartsOn) => commitSection("time", { weekStartsOn }, "Calendar week start saved.")}
            options={SETTINGS_WEEK_STARTS.map((day) => [day, titleCase(day)])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "language") {
      return (
        <SettingsDetail title="Language" description="Choose your saved locale and browser accessibility language. Interface copy remains English for now." onBack={closePanel}>
          <SelectionRows
            ariaLabel="Language"
            value={settings.language.code}
            onSelect={(code) => commitSection("language", { code }, "Language preference saved.")}
            options={TASKFLOW_LANGUAGES.map(({ code, name, locale }) => [code, name, `${locale} locale`])}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "importData") {
      return (
        <PlaceholderPanel
          title="Import Data"
          description="Import validation and preview infrastructure is not implemented."
          onBack={closePanel}
        >
          <p>Import functionality will be available here after a supported file schema is approved.</p>
          <button className="secondary-btn" type="button" onClick={downloadExport}>Export TaskFlow data</button>
        </PlaceholderPanel>
      );
    }

    if (activePanel === "projectReminders") {
      return (
        <ProjectRemindersPanel
          reminder={settings.reminder}
          onBack={closePanel}
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
          onBack={closePanel}
        />
      );
    }

    if (activePanel === "whatsNew") {
      return (
        <SettingsDetail title="What's New?" description="Features present in this TaskFlow branch." onBack={closePanel}>
          <ol className="settings-release-list">
            <li><strong>Archived Tasks</strong><span>Archive, restore, and permanently remove tasks.</span></li>
            <li><strong>Calendar and reminders</strong><span>Month, week, day, agenda, and scheduled reminders.</span></li>
            <li><strong>Project task management</strong><span>Project assignment, project task views, and membership foundations.</span></li>
          </ol>
        </SettingsDetail>
      );
    }

    if (activePanel === "shortcuts") {
      return (
        <SettingsDetail title="Keyboard Shortcuts" description="Only interactions implemented today are listed." onBack={closePanel}>
          <div className="settings-shortcuts">
            <p><kbd>Esc</kbd><span>Close an open task dialog when safe.</span></p>
            <p><kbd>Tab</kbd><span>Move through available controls and dialog fields.</span></p>
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "about") {
      return (
        <SettingsDetail title="About" description="Application information." onBack={closePanel}>
          <div className="settings-about-copy">
            <p><strong>TaskFlow</strong></p>
            <p>Version 0.0.0</p>
            <p>React, Vite, and Supabase productivity application.</p>
            <p>No verified Terms or Privacy links are configured.</p>
          </div>
        </SettingsDetail>
      );
    }

    return null;
  };

  return (
    <div className="settings-page">
      {error && (
        <div className="settings-banner settings-banner-error" role="alert">
          <span>{error}</span>
          <button className="ghost-btn compact-btn" type="button" onClick={onRetry}>Retry</button>
        </div>
      )}

      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validationError) onSave(settings);
        }}
      >
        {activePanel ? renderPanel() : (
          <div className="settings-overview">
            <header className="settings-sheet-account-header">
              <span aria-hidden="true">{(settings.profile.displayName || settings.profile.email)?.[0]?.toUpperCase() || "U"}</span>
              <div>
                <strong>{settings.profile.displayName || "TaskFlow user"}</strong>
                <small>{settings.profile.email}</small>
              </div>
            </header>
            <AccountSettingsSection
              displayName={settings.profile.displayName}
              onOpenProfile={() => openPanel("profile")}
              onOpenArchivedTasks={() => onNavigate?.("/archived-tasks")}
              onOpenImportData={() => openPanel("importData")}
            />
            <ProjectsSettingsSection
              defaultReminderTime={settings.reminder.defaultTime}
              archivedProjectCount={archivedProjects.length}
              onOpenProjectReminders={() => openPanel("projectReminders")}
              onOpenArchivedProjects={() => openPanel("archivedProjects")}
              onOpenProjectCreate={onOpenProjectCreate}
            />
            <PreferencesSettingsSection
              myDayLabel={settings.myDay.resetMode === "midnight" ? "Midnight" : titleCase(settings.myDay.resetMode)}
              connectedCalendarCount={connectedCalendarCount}
              themeLabel={themeLabel}
              backgroundLabel={backgroundLabel}
              browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
              defaultViewLabel={defaultViewLabel}
              defaultListLabel={selectedList?.name || "Inbox"}
              timeSettingsLabel={`${settings.time.format === "12-hour" ? "12 Hour" : "24 Hour"} · ${weekStartLabel}`}
              languageLabel={languageLabel}
              onOpenMyDay={() => openPanel("myDay")}
              onOpenCalendars={() => openPanel("calendars")}
              onOpenTheme={() => openPanel("theme")}
              onOpenBackground={() => openPanel("background")}
              onToggleBrowserNotifications={(enabled) => void enableBrowserNotifications(enabled)}
              onOpenDefaultView={() => openPanel("defaultView")}
              onOpenDefaultList={() => openPanel("defaultList")}
              onOpenTimeSettings={() => openPanel("timeSettings")}
              onOpenLanguage={() => openPanel("language")}
            />
            <TaskflowSettingsSection
              onOpenWhatsNew={() => openPanel("whatsNew")}
              onOpenShortcuts={() => openPanel("shortcuts")}
              onOpenAbout={() => openPanel("about")}
            />
          </div>
        )}

        {activePanel !== "projectReminders" && (notificationMessage || panelMessage || saveMessage) && (
          <p className="settings-inline-note" role="status">
            {notificationMessage || panelMessage || saveMessage}
          </p>
        )}
        {validationError && <p className="form-error settings-validation" role="alert">{validationError}</p>}

      </form>

    </div>
  );
}
