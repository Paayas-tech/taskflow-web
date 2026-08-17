import { useEffect, useMemo, useState } from "react";
import {
  SETTINGS_DATE_FORMATS,
  SETTINGS_DEFAULT_VIEWS,
  SETTINGS_TIME_FORMATS,
  SETTINGS_WEEK_STARTS,
  TASKFLOW_BACKGROUNDS,
  getSettingsValidationError,
} from "./domain/settingsDomain";
import {
  CALENDAR_PROVIDERS,
  calendarProviderSetup,
  emptyCalendarConnection,
} from "./domain/calendarConnectionDomain";
import { requestNotificationPermission } from "./services/reminderService";

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
  ["today", "Today"],
  ["tasks", "All Tasks"],
  ["projects", "Projects"],
  ["calendar", "Calendar"],
  ["last-viewed", "Last Viewed"],
].filter(([value]) => SETTINGS_DEFAULT_VIEWS.includes(value));

function SettingsGroup({ title, children }) {
  return (
    <section className="settings-list-section" aria-labelledby={`settings-${title}`}>
      <h2 id={`settings-${title}`}>{title}</h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

function SettingsRow({ label, value, onClick, disabled = false, selected = false }) {
  return (
    <button
      className="settings-list-row"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      <span className="settings-row-end">
        {value && <small>{value}</small>}
        {selected ? (
          <span className="settings-check" aria-label="Selected">✓</span>
        ) : (
          !disabled && <span className="settings-chevron" aria-hidden="true">›</span>
        )}
      </span>
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled = false, status }) {
  return (
    <label className={`settings-list-row settings-list-toggle ${disabled ? "is-disabled" : ""}`}>
      <span className="settings-toggle-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="settings-row-end">
        {status && <small>{status}</small>}
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          disabled={disabled}
        />
      </span>
    </label>
  );
}

function SettingsDetail({ title, description, onBack, children, headerAction }) {
  return (
    <section className="settings-detail" aria-labelledby="settings-detail-title">
      <header className="settings-detail-navigation">
        <button className="settings-back" type="button" onClick={onBack} aria-label={`Back from ${title}`}>
          <span aria-hidden="true">←</span>
        </button>
        <h2 id="settings-detail-title">{title}</h2>
        <span className="settings-detail-header-action">{headerAction}</span>
      </header>
      {description && <p className="settings-detail-description">{description}</p>}
      {children}
    </section>
  );
}

function SelectionRows({ options, value, onSelect, ariaLabel }) {
  return (
    <div className="settings-compact-list" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([optionValue, label, description]) => (
        <label
          className={`settings-choice-row ${value === optionValue ? "is-selected" : ""}`}
          key={optionValue}
        >
          <span>
            <strong>{label}</strong>
            {description && <small>{description}</small>}
          </span>
          <input
            type="radio"
            name={ariaLabel}
            value={optionValue}
            checked={value === optionValue}
            onChange={() => onSelect(optionValue)}
          />
          <span className="settings-check" aria-hidden="true">
            {value === optionValue ? "✓" : ""}
          </span>
        </label>
      ))}
    </div>
  );
}

function UnavailableProviders({ providers }) {
  return (
    <div className="settings-compact-list">
      {providers.map((provider) => (
        <div className="settings-provider-row" key={provider}>
          <span>
            <strong>{provider}</strong>
            <small>No connection is configured.</small>
          </span>
          <button className="ghost-btn compact-btn" type="button" disabled>
            Not available
          </button>
        </div>
      ))}
    </div>
  );
}

function PlaceholderPanel({ title, description, onBack, children }) {
  return (
    <SettingsDetail title={title} description={description} onBack={onBack}>
      <div className="settings-placeholder-panel">
        {children || <p>This capability is not connected in TaskFlow yet.</p>}
      </div>
    </SettingsDetail>
  );
}

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
  onNavigate,
  onOpenProjectCreate,
  onRestoreProject,
  exportData,
}) {
  const [panelStack, setPanelStack] = useState([]);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [panelMessage, setPanelMessage] = useState("");
  const [backgroundSearch, setBackgroundSearch] = useState("");
  const [confirmingFilterReset, setConfirmingFilterReset] = useState(false);
  const [projectActionId, setProjectActionId] = useState("");
  const [calendarSetupProviderId, setCalendarSetupProviderId] = useState("");
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
  const themeLabel = settings.theme.mode === "system" ? "Auto" : titleCase(settings.theme.mode);
  const backgroundLabel =
    TASKFLOW_BACKGROUNDS.find(
      ({ id }) => id === settings.background.selected
    )?.name || "Calm";
  const defaultViewLabel =
    defaultViewOptions.find(([value]) => value === settings.navigation.defaultView)?.[1] || "Dashboard";
  const weekStartLabel = titleCase(settings.time.weekStartsOn);
  const connectedCalendarCount = CALENDAR_PROVIDERS.filter(
    ({ id }) => settings.calendarConnections[id]?.connected
  ).length;
  const selectedCalendarProvider = CALENDAR_PROVIDERS.find(
    ({ id }) => id === calendarSetupProviderId
  );

  useEffect(() => {
    if (!calendarSetupProviderId) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCalendarSetupProviderId("");
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [calendarSetupProviderId]);

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
        <SettingsDetail title="My Profile" description="Account details shown by TaskFlow." onBack={closePanel}>
          <div className="settings-profile-panel">
            <div className="settings-profile-summary" aria-label="Profile avatar">
              <span aria-hidden="true">
                {(settings.profile.displayName || settings.profile.email)?.[0]?.toUpperCase() || "U"}
              </span>
              <p>TaskFlow currently uses your initial. Custom avatar uploads are not supported.</p>
            </div>
            <label className="settings-field">
              <span>Display name</span>
              <input
                type="text"
                maxLength="80"
                value={settings.profile.displayName}
                onChange={(event) =>
                  onChange(updateSection(settings, "profile", { displayName: event.target.value }))
                }
                placeholder="How TaskFlow should address you"
                disabled={saving}
              />
            </label>
            <label className="settings-field">
              <span>Email</span>
              <input type="email" value={settings.profile.email} disabled readOnly />
              <small>Email is managed by your TaskFlow authentication account.</small>
            </label>
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "integrations") {
      return (
        <PlaceholderPanel
          title="Integrations"
          description="Prepared connection points without simulated accounts."
          onBack={closePanel}
        >
          <UnavailableProviders providers={["Google Calendar", "Microsoft Outlook", "iCloud"]} />
        </PlaceholderPanel>
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
        <SettingsDetail
          title="Calendar Settings"
          description="Connect controls show the exact provider configuration TaskFlow still requires."
          onBack={closePanel}
        >
          <div className="settings-compact-list settings-calendar-providers">
            {CALENDAR_PROVIDERS.map((provider) => {
              const connection = settings.calendarConnections[provider.id];
              return (
                <div className="settings-provider-row" key={provider.id}>
                  <span>
                    <strong>{provider.name}</strong>
                    <small>
                      {connection.connected
                        ? connection.accountLabel || "Connected account"
                        : "Not connected"}
                    </small>
                  </span>
                  {connection.connected ? (
                    <button
                      className="ghost-btn compact-btn"
                      type="button"
                      onClick={() => void disconnectCalendar(provider)}
                      disabled={saving}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className="secondary-btn compact-btn"
                      type="button"
                      onClick={() => setCalendarSetupProviderId(provider.id)}
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedCalendarProvider && setup && (
            <div
              className="settings-connection-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setCalendarSetupProviderId("");
                }
              }}
            >
              <section
                className="settings-connection-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="calendar-connection-title"
              >
                <header>
                  <div>
                    <p className="card-label">Calendar connection</p>
                    <h3 id="calendar-connection-title">
                      Connect {selectedCalendarProvider.name}
                    </h3>
                  </div>
                  <button
                    className="ghost-btn compact-btn"
                    type="button"
                    onClick={() => setCalendarSetupProviderId("")}
                    aria-label="Close calendar connection setup"
                  >
                    Close
                  </button>
                </header>
                <div className="settings-connection-content">
                  <p>
                    TaskFlow cannot start this authorization securely until
                    its provider configuration and server-side token handler
                    are available.
                  </p>
                  {setup.missingVariables.length > 0 && (
                    <div className="settings-connection-requirements">
                      <strong>Required configuration</strong>
                      <ul>
                        {setup.missingVariables.map((variableName) => (
                          <li key={variableName}>
                            <code>{variableName}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p>{selectedCalendarProvider.setup}</p>
                  <p className="settings-connection-security-note">
                    Client secrets, access tokens, refresh tokens, passwords,
                    and Apple app-specific passwords must not be stored in
                    Vite variables or TaskFlow local settings.
                  </p>
                </div>
                <footer>
                  <button className="primary-btn" type="button" disabled>
                    Authorization unavailable
                  </button>
                </footer>
              </section>
            </div>
          )}
        </SettingsDetail>
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
              ["system", "Auto", "Follow your system appearance"],
              ["light", "Light", "Always use the light theme"],
              ["dark", "Dark", "Always use the dark theme"],
            ]}
          />
        </SettingsDetail>
      );
    }

    if (activePanel === "background") {
      const normalizedSearch = backgroundSearch.trim().toLowerCase();
      const visibleBackgrounds = TASKFLOW_BACKGROUNDS.filter(
        ({ name, category, description }) =>
          `${name} ${category} ${description}`
            .toLowerCase()
            .includes(normalizedSearch)
      );
      return (
        <SettingsDetail
          title="Choose Background"
          description="TaskFlow-created abstract surfaces; selection applies immediately."
          onBack={closePanel}
          headerAction={<span aria-hidden="true">⌕</span>}
        >
          <label className="settings-background-search">
            <span className="sr-only">Search backgrounds</span>
            <input
              type="search"
              value={backgroundSearch}
              onChange={(event) => setBackgroundSearch(event.target.value)}
              placeholder="Search backgrounds"
            />
          </label>
          <div className="settings-background-grid">
            {visibleBackgrounds.map(({ id, name, category, description }) => (
              <button
                key={id}
                className={`settings-background-option background-${id} ${
                  settings.background.selected === id ? "is-selected" : ""
                }`}
                type="button"
                onClick={() =>
                  void commitSettings(
                    {
                      ...settings,
                      background: { selected: id },
                      appearance: { ...settings.appearance, background: id },
                    },
                    `${name} background saved.`
                  )
                }
              >
                <span className="settings-background-preview" aria-hidden="true" />
                <span>
                  <strong>{name}</strong>
                  <small>{category} · {description}</small>
                </span>
                {settings.background.selected === id && <span className="settings-background-check">✓</span>}
              </button>
            ))}
          </div>
          {visibleBackgrounds.length === 0 && (
            <div className="settings-background-empty" role="status">
              No backgrounds match your search.
            </div>
          )}
        </SettingsDetail>
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
        <SettingsDetail title="Language" description="English is the only translation bundled with TaskFlow." onBack={closePanel}>
          <SelectionRows ariaLabel="Language" value="en" onSelect={() => undefined} options={[["en", "English", "Current application language"]]} />
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
        <SettingsDetail
          title="Project Reminders"
          description="TaskFlow currently supports a shared reminder default, not project-specific policies."
          onBack={closePanel}
        >
          <div className="settings-reminder-preferences">
            <label className="settings-inline-field">
              <span>Default reminder (minutes before)</span>
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.reminder.defaultTime}
                onChange={(event) =>
                  onChange(updateSection(settings, "reminder", { defaultTime: Number(event.target.value) }))
                }
              />
            </label>
            <ToggleRow
              label="In-app reminders"
              description="Show TaskFlow reminders while the app is open."
              checked={settings.reminder.enableInAppReminders}
              onChange={(enableInAppReminders) =>
                void commitSection("reminder", { enableInAppReminders }, "Reminder preference saved.")
              }
            />
            <ToggleRow
              label="Reminder sound"
              description="Play a subtle sound for delivered reminders."
              checked={settings.reminder.enableSound}
              onChange={(enableSound) =>
                void commitSection("reminder", { enableSound }, "Reminder sound preference saved.")
              }
            />
          </div>
        </SettingsDetail>
      );
    }

    if (activePanel === "archivedProjects") {
      return (
        <SettingsDetail title="Archived Projects" description="Projects already marked archived." onBack={closePanel}>
          {archivedProjects.length ? (
            <div className="settings-compact-list settings-archived-projects">
              {archivedProjects.map((project) => (
                <div className="settings-archived-project" key={project.id}>
                  <div>
                    <strong>{project.name}</strong>
                    {project.description && <small>{project.description}</small>}
                  </div>
                  <div className="settings-archived-project-actions">
                    <button
                      className="ghost-btn compact-btn"
                      type="button"
                      onClick={() => onNavigate?.(`/projects/${encodeURIComponent(project.id)}`)}
                      disabled={projectActionId === project.id}
                    >
                      View
                    </button>
                    <button
                      className="ghost-btn compact-btn"
                      type="button"
                      onClick={() => void restoreArchivedProject(project)}
                      disabled={projectActionId === project.id}
                    >
                      {projectActionId === project.id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="settings-placeholder-panel"><p>No archived projects.</p></div>
          )}
        </SettingsDetail>
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

    if (activePanel === "support") {
      return (
        <PlaceholderPanel
          title="Support"
          description="TaskFlow does not currently publish a help center, support address, or feedback endpoint."
          onBack={closePanel}
        >
          <p>No verified support resource is available in this repository.</p>
        </PlaceholderPanel>
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
            <SettingsGroup title="account">
              <SettingsRow label="My Profile" value={settings.profile.displayName || "Account details"} onClick={() => openPanel("profile")} />
              <SettingsRow label="Integrations" value="Not connected" onClick={() => openPanel("integrations")} />
              <SettingsRow label="Archived Tasks" onClick={() => onNavigate?.("/archived-tasks")} />
              <SettingsRow label="Import Data" value="Not available" onClick={() => openPanel("importData")} />
            </SettingsGroup>

            <SettingsGroup title="projects">
              <SettingsRow label="Project Reminders" value={`${settings.reminder.defaultTime} min`} onClick={() => openPanel("projectReminders")} />
              <SettingsRow label="Archived Projects" value={String(archivedProjects.length)} onClick={() => openPanel("archivedProjects")} />
              <SettingsRow label="Create a New Project" onClick={onOpenProjectCreate} />
            </SettingsGroup>

            <SettingsGroup title="preferences">
              <SettingsRow label="My Day" value={settings.myDay.resetMode === "midnight" ? "Midnight" : titleCase(settings.myDay.resetMode)} onClick={() => openPanel("myDay")} />
              <SettingsRow
                label="Calendars"
                value={
                  connectedCalendarCount
                    ? `${connectedCalendarCount} connected`
                    : "Not connected"
                }
                onClick={() => openPanel("calendars")}
              />
              <SettingsRow label="Theme" value={themeLabel} onClick={() => openPanel("theme")} />
              <SettingsRow label="Background" value={backgroundLabel} onClick={() => openPanel("background")} />
              <ToggleRow
                label="Desktop Notifications"
                checked={settings.reminder.enableBrowserNotifications}
                onChange={(enabled) => void enableBrowserNotifications(enabled)}
                status={settings.reminder.enableBrowserNotifications ? "ON" : "OFF"}
              />
              <SettingsRow label="Default View" value={defaultViewLabel} onClick={() => openPanel("defaultView")} />
              <SettingsRow label="Default List" value={selectedList?.name || "Inbox"} onClick={() => openPanel("defaultList")} />
              <SettingsRow label="Time Settings" value={`${settings.time.format === "12-hour" ? "12 Hour" : "24 Hour"} · ${weekStartLabel}`} onClick={() => openPanel("timeSettings")} />
              <SettingsRow label="Language" value="English" onClick={() => openPanel("language")} />
            </SettingsGroup>

            <SettingsGroup title="taskflow">
              <SettingsRow label="What's New?" onClick={() => openPanel("whatsNew")} />
              <SettingsRow label="Keyboard Shortcuts" onClick={() => openPanel("shortcuts")} />
              <SettingsRow label="Support" value="Not available" onClick={() => openPanel("support")} />
              <SettingsRow label="About" value="0.0.0" onClick={() => openPanel("about")} />
            </SettingsGroup>
          </div>
        )}

        {(notificationMessage || panelMessage || saveMessage) && (
          <p className="settings-inline-note" role="status">
            {notificationMessage || panelMessage || saveMessage}
          </p>
        )}
        {validationError && <p className="form-error settings-validation" role="alert">{validationError}</p>}

        {(activePanel === "profile" || activePanel === "projectReminders") && (
          <div className="settings-save-bar">
            <p>{activePanel === "profile" ? "Save profile changes." : "Save the reminder offset after editing."}</p>
            <button className="primary-btn" type="submit" disabled={saving || Boolean(validationError)}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        )}
      </form>

      <div className="settings-signout-row">
        <button className="ghost-btn settings-signout" type="button" onClick={onSignOut}>
          Sign out of TaskFlow
        </button>
      </div>
    </div>
  );
}
