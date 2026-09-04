/**
 * Settings: an overview of every preference group, and one detail panel at a
 * time behind it. Everything shown comes from the store; every committed change
 * is a single `saveSettings` call, applied optimistically by the store and
 * rolled back there if the write fails.
 */
import { useEffect, useMemo, useState } from "react";
import {
  SETTINGS_DATE_FORMATS,
  SETTINGS_DEFAULT_VIEWS,
  SETTINGS_TIME_FORMATS,
  SETTINGS_WEEK_STARTS,
  TASKFLOW_LANGUAGES,
  formatTimeForDisplay,
  myDayResetTime,
} from "../domain/settings";
import { CALENDAR_PROVIDERS } from "../domain/calendar";
import { requestNotificationPermission } from "../store/reminders";
import {
  selectArchivedTasks,
  selectErrors,
  selectLoaded,
  selectMyTasks,
  selectProfileSettingsRequest,
  selectProjects,
  selectSettings,
} from "../store/selectors";
import { loadSettings } from "../store/session";
import { saveSettings } from "../store/settings";
import { useStore } from "../store/store";
import {
  consumeProfileSettingsRequest,
  navigate,
  openProjectCreate,
} from "../store/ui";
import { Avatar, Button, Field, Icon, InlineNotice, Input, Kbd, Spinner } from "../ui";
import {
  SelectionRows,
  SettingsDetail,
  SettingsGroup,
  SettingsRow,
  ToggleRow,
} from "../settings/controls";
import {
  ArchivedProjectsPanel,
  CalendarsPanel,
  ProfilePanel,
  RemindersPanel,
} from "../settings/panels";

/**
 * Every panel that is nothing but a single-choice list: which settings section
 * it writes, and the options it offers. The overview rows read their value
 * label from the same table. `ariaLabel` names the radio group when the panel
 * title would not read well as one.
 */
const SELECTION_PANELS = {
  theme: {
    title: "Theme",
    description: "Choose your appearance.",
    section: "theme",
    key: "mode",
    savedMessage: "Theme saved.",
    options: [
      ["light", "Light", "Always use the light theme"],
      ["dark", "Dark", "Always use the dark theme"],
    ],
  },
  defaultView: {
    title: "Default view",
    description: "Choose your start page.",
    section: "navigation",
    key: "defaultView",
    savedMessage: "Default view saved.",
    options: [
      ["dashboard", "Home", "Start on the home view"],
      ["tasks", "My tasks", "Start on your task list"],
      ["projects", "Projects", "Start on the project list"],
      ["calendar", "Calendar", "Start on the calendar"],
      ["last-viewed", "Last viewed", "Continue where you left off"],
    ].filter(([value]) => SETTINGS_DEFAULT_VIEWS.includes(value)),
  },
  timeFormat: {
    title: "Time format",
    section: "time",
    key: "format",
    savedMessage: "Time format saved.",
    options: SETTINGS_TIME_FORMATS.map((format) => [
      format,
      format === "12-hour" ? "12 hour" : "24 hour",
    ]),
  },
  dateFormat: {
    title: "Date format",
    section: "time",
    key: "dateFormat",
    savedMessage: "Date format saved.",
    options: SETTINGS_DATE_FORMATS.map((format) => [format, format]),
  },
  weekStart: {
    title: "Week starts on",
    ariaLabel: "First day of week",
    section: "time",
    key: "weekStartsOn",
    savedMessage: "Calendar week start saved.",
    options: SETTINGS_WEEK_STARTS.map((day) => [
      day,
      day === "monday" ? "Monday" : "Sunday",
    ]),
  },
  language: {
    title: "Language",
    description: "Choose your locale. Interface text remains English.",
    section: "language",
    key: "code",
    savedMessage: "Language preference saved.",
    options: TASKFLOW_LANGUAGES.map(({ code, name, locale }) => [
      code,
      name,
      `${locale} locale`,
    ]),
  },
};

const PANEL_TITLES = {
  profile: "Profile",
  projectReminders: "Project reminders",
  archivedProjects: "Archived projects",
  myDay: "My day",
  calendars: "Calendars",
  timeSettings: "Time settings",
  shortcuts: "Keyboard shortcuts",
  about: "About",
  ...Object.fromEntries(
    Object.entries(SELECTION_PANELS).map(([panel, { title }]) => [panel, title])
  ),
};

/** The stored label of a selection panel's current value. */
const selectionLabel = (settings, panel) => {
  const { section, key, options } = SELECTION_PANELS[panel];
  const value = settings[section][key];
  return options.find(([option]) => option === value)?.[1] || options[0][1];
};

const MY_DAY_OPTIONS = [
  ["midnight", "Midnight", "Reset at 12:00 AM"],
  ["early-morning", "Early morning", "Reset at 6:00 AM"],
  ["custom", "Custom time", "Choose a local reset time"],
];

/** The preset modes pin the reset time; "custom" keeps whatever was chosen. */
const MY_DAY_RESET_TIMES = { midnight: "00:00", "early-morning": "06:00" };

const SHORTCUTS = [
  ["Open search", ["⌘K", "/"]],
  ["Close a dialog or panel", ["Esc"]],
  ["Move through controls", ["Tab"]],
];

/** Browser permission → what the page explains once the preference is saved. */
const NOTIFICATION_EXPLANATIONS = {
  granted: "TaskFlow notifications are enabled and browser permission is granted.",
  denied: "TaskFlow notifications remain off because browser permission is blocked.",
  unavailable: "Desktop notifications are unavailable in this browser.",
};

/** The `?integration=google` return trip from the OAuth consent screen. */
const readGoogleCallback = () => {
  if (typeof window === "undefined") return null;
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("integration") !== "google") return null;
  return {
    status: parameters.get("google_calendar") === "connected" ? "connected" : "error",
    reason: parameters.get("reason") || "",
  };
};

export function SettingsPage() {
  const settings = useStore(selectSettings);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const projects = useStore(selectProjects);
  const myTasks = useStore(selectMyTasks);
  const archivedTasks = useStore(selectArchivedTasks);
  const profileRequest = useStore(selectProfileSettingsRequest);

  const googleCallback = useMemo(readGoogleCallback, []);
  const [panelStack, setPanelStack] = useState(() =>
    googleCallback ? ["calendars"] : []
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);

  const activePanel = panelStack.at(-1) || null;
  const archivedProjectCount = projects.filter(
    (project) => project.status === "archived"
  ).length;
  const connectedCalendarCount =
    CALENDAR_PROVIDERS.filter(
      ({ id }) => id !== "google" && settings.calendarConnections[id].connected
    ).length + (googleConnected ? 1 : 0);

  // A display-name problem belongs on its own field; anything else is a notice.
  const settingsError = errors.settings || "";
  const loadFailed = loaded.settings === "error" && Boolean(settingsError);
  const displayNameError =
    activePanel === "profile" && settingsError.startsWith("Display name")
      ? settingsError
      : "";
  const errorNotice =
    loadFailed || (settingsError && !displayNameError) ? settingsError : "";

  // The user menu's "Edit profile" opens this page straight on the profile panel.
  useEffect(() => {
    if (!profileRequest) return;
    setSaveMessage("");
    setPanelStack(["profile"]);
    consumeProfileSettingsRequest();
  }, [profileRequest]);

  useEffect(() => {
    if (!googleCallback || typeof window === "undefined") return;
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history?.replaceState?.({}, "", cleanUrl);
  }, [googleCallback]);

  const openPanel = (panel) => {
    setSaveMessage("");
    setPanelStack((stack) => [...stack, panel]);
  };

  const closePanel = () => {
    setSaveMessage("");
    setPanelStack((stack) => stack.slice(0, -1));
  };

  /** One committed change: patch a settings section and write the whole object. */
  const commit = async (section, patch, message = "Changes saved.") => {
    setSaving(true);
    setSaveMessage("");
    const result = await saveSettings({
      ...settings,
      [section]: { ...settings[section], ...patch },
    });
    setSaving(false);
    setSaveMessage(result ? message : "");
    return Boolean(result);
  };

  const toggleBrowserNotifications = async (enabled) => {
    setNotificationMessage("");
    if (!enabled) {
      await commit(
        "reminder",
        { enableBrowserNotifications: false },
        "Desktop notifications disabled."
      );
      return;
    }

    const permission = await requestNotificationPermission();
    const granted = permission === "granted";
    await commit(
      "reminder",
      { enableBrowserNotifications: granted },
      granted ? "Desktop notifications enabled." : "Browser permission is required."
    );
    setNotificationMessage(
      NOTIFICATION_EXPLANATIONS[permission] || NOTIFICATION_EXPLANATIONS.unavailable
    );
  };

  const downloadExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      // A backup keeps the archived tasks too; they are still the person's.
      tasks: [...myTasks, ...archivedTasks],
      projects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loaded.settings === "loading") {
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

  /** A row that opens a panel; the panel's title is the row's label. */
  const panelRow = (panel, value) => ({
    label: PANEL_TITLES[panel],
    value,
    onClick: () => openPanel(panel),
  });

  const renderPanel = () => {
    const selection = SELECTION_PANELS[activePanel];
    if (selection) {
      return (
        <SettingsDetail title={selection.title} description={selection.description}>
          <SelectionRows
            ariaLabel={selection.ariaLabel || selection.title}
            value={settings[selection.section][selection.key]}
            onSelect={(value) =>
              void commit(
                selection.section,
                { [selection.key]: value },
                selection.savedMessage
              )
            }
            options={selection.options}
          />
        </SettingsDetail>
      );
    }

    const panels = {
      profile: () => (
        <ProfilePanel commit={commit} saving={saving} error={displayNameError} />
      ),
      projectReminders: () => <RemindersPanel commit={commit} />,
      archivedProjects: () => <ArchivedProjectsPanel />,
      calendars: () => (
        <CalendarsPanel
          commit={commit}
          saving={saving}
          callback={googleCallback}
          onConnectedChange={setGoogleConnected}
        />
      ),
      myDay: () => (
        <SettingsDetail title="My day" description="Set when your day resets.">
          <SelectionRows
            ariaLabel="My day reset time"
            value={settings.myDay.resetMode}
            onSelect={(resetMode) =>
              void commit(
                "myDay",
                {
                  resetMode,
                  customResetTime:
                    MY_DAY_RESET_TIMES[resetMode] || settings.myDay.customResetTime,
                },
                "My day reset time saved."
              )
            }
            options={MY_DAY_OPTIONS}
          />
          {settings.myDay.resetMode === "custom" ? (
            <Field label="Custom reset time" htmlFor="settings-custom-reset-time" inline>
              <Input
                id="settings-custom-reset-time"
                className="settings-time-input"
                type="time"
                value={settings.myDay.customResetTime}
                onChange={(event) =>
                  void commit(
                    "myDay",
                    { customResetTime: event.target.value },
                    "Custom reset time saved."
                  )
                }
              />
            </Field>
          ) : null}
        </SettingsDetail>
      ),
      timeSettings: () => (
        <SettingsDetail title="Time settings" description="Set date and time formats.">
          <div className="row-list">
            {["timeFormat", "dateFormat", "weekStart"].map((panel) => (
              <SettingsRow key={panel} {...panelRow(panel, selectionLabel(settings, panel))} />
            ))}
          </div>
        </SettingsDetail>
      ),
      shortcuts: () => (
        <SettingsDetail title="Keyboard shortcuts" description="Available keyboard actions.">
          <div className="row-list">
            {SHORTCUTS.map(([action, keys]) => (
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
      ),
      about: () => (
        <SettingsDetail title="About" description="Application information.">
          <div className="settings-about">
            <p className="settings-about-name">TaskFlow</p>
            <p className="muted">Version 0.0.0</p>
            <p className="muted">React, Vite, and Supabase productivity application.</p>
            <p className="muted">No verified terms or privacy links are configured.</p>
          </div>
        </SettingsDetail>
      ),
    };

    return panels[activePanel]?.() ?? null;
  };

  /** The overview: one card per group, each row either navigating or a switch. */
  const renderOverview = () => {
    const groups = [
      [
        "Account",
        [
          panelRow("profile", settings.profile.displayName || "Account details"),
          { label: "Archived tasks", onClick: () => navigate("/archived-tasks") },
          { label: "Export data", value: "JSON", onClick: downloadExport },
        ],
      ],
      [
        "Projects",
        [
          panelRow("projectReminders", `${settings.reminder.defaultTime} min`),
          panelRow("archivedProjects", String(archivedProjectCount)),
          { label: "New project", onClick: openProjectCreate },
        ],
      ],
      [
        "Preferences",
        [
          panelRow(
            "myDay",
            formatTimeForDisplay(myDayResetTime(settings.myDay), settings.time.format)
          ),
          panelRow(
            "calendars",
            connectedCalendarCount ? `${connectedCalendarCount} connected` : "Not connected"
          ),
          panelRow("theme", selectionLabel(settings, "theme")),
          {
            label: "Desktop notifications",
            description: "Show reminders outside TaskFlow.",
            checked: settings.reminder.enableBrowserNotifications,
            onChange: (enabled) => void toggleBrowserNotifications(enabled),
          },
          panelRow("defaultView", selectionLabel(settings, "defaultView")),
          panelRow(
            "timeSettings",
            `${selectionLabel(settings, "timeFormat")} · ${selectionLabel(settings, "weekStart")}`
          ),
          panelRow("language", selectionLabel(settings, "language")),
        ],
      ],
      ["TaskFlow", [panelRow("shortcuts"), panelRow("about", "0.0.0")]],
    ];

    return (
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

        {groups.map(([title, rows]) => (
          <SettingsGroup title={title} key={title}>
            {rows.map((row) =>
              row.onChange ? (
                <ToggleRow key={row.label} {...row} />
              ) : (
                <SettingsRow key={row.label} {...row} />
              )
            )}
          </SettingsGroup>
        ))}
      </div>
    );
  };

  const feedbackMessage = notificationMessage || saveMessage;

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
        <h1 className="page-title">{activePanel ? PANEL_TITLES[activePanel] : "Settings"}</h1>
      </header>

      <div className="page-body is-narrow">
        {errorNotice ? (
          <InlineNotice
            tone="error"
            className="page-notice"
            action={
              loadFailed ? (
                <Button size="sm" onClick={() => void loadSettings()}>
                  Retry
                </Button>
              ) : null
            }
          >
            {errorNotice}
          </InlineNotice>
        ) : null}

        {feedbackMessage ? (
          <InlineNotice tone="success" className="page-notice">
            {feedbackMessage}
          </InlineNotice>
        ) : null}

        {activePanel ? renderPanel() : renderOverview()}
      </div>
    </section>
  );
}
