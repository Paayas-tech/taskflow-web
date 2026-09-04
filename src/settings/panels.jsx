/**
 * The settings sub-panels that carry logic of their own: the profile form and
 * its account actions, project reminders, archived projects and the calendar
 * connections. Each reads what it displays from the store; a committed
 * preference change goes through the page's `commit(section, patch, message)`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Icon,
  InlineNotice,
  Input,
  Spinner,
} from "../ui";
import {
  CALENDAR_PROVIDERS,
  calendarProviderSetup,
  emptyCalendarConnection,
} from "../domain/calendar";
import {
  disconnectGoogleCalendar,
  getGoogleConnection,
  startGoogleOAuth,
  syncGoogleCalendar,
} from "../api/calendar";
import { openExternalAuthorization } from "../platform/desktop";
import { deleteAccountAndSignOut, signOutAccount } from "../auth/accountActions";
import { setGoogleEvents } from "../store/calendar";
import { updateProject } from "../store/projects";
import { selectProjects, selectSettings } from "../store/selectors";
import { useStore } from "../store/store";
import { navigate } from "../store/ui";
import { SettingsDetail, ToggleRow } from "./controls";

/* -------------------------------------------------------------------------
 * Profile
 * ---------------------------------------------------------------------- */

/**
 * The display-name form plus the account actions. A display-name problem is
 * reported on the field by the page; everything else stays local to the panel.
 */
export function ProfilePanel({ commit, saving = false, error = "" }) {
  const settings = useStore(selectSettings);
  const storedName = settings.profile.displayName;
  const email = settings.profile.email;

  const [displayName, setDisplayName] = useState(storedName);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // A save (or a sign-in on another tab) is the source of truth for the field.
  useEffect(() => {
    setDisplayName(storedName);
  }, [storedName]);

  const handleSignOut = async () => {
    setSignOutPending(true);
    setSignOutError("");
    const failure = await signOutAccount();
    setSignOutPending(false);
    setSignOutError(failure);
  };

  const handleDeleteAccount = async () => {
    setDeletePending(true);
    setDeleteError("");
    const failure = await deleteAccountAndSignOut();
    setDeletePending(false);
    setDeleteError(failure);
    if (!failure) setConfirmingDelete(false);
  };

  return (
    <SettingsDetail title="Profile" description="Your name is visible to project members.">
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void commit("profile", { displayName }, "Profile saved.");
        }}
      >
        <div className="settings-identity">
          <Avatar name={displayName || email} size="lg" />
          <div className="settings-identity-body">
            <span className="settings-identity-name">{displayName || "TaskFlow user"}</span>
            <span className="settings-identity-email">{email}</span>
          </div>
        </div>

        <Field label="Display name" htmlFor="settings-display-name" error={error}>
          <Input
            id="settings-display-name"
            maxLength={80}
            placeholder="Enter your name"
            value={displayName}
            disabled={saving}
            invalid={Boolean(error)}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="settings-email"
          hint="Your sign-in email is managed by your account."
        >
          <Input id="settings-email" type="email" value={email} readOnly disabled />
        </Field>

        <div className="settings-form-actions">
          <Button variant="primary" type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>

      <section className="settings-danger" aria-label="Account actions">
        <div className="settings-danger-heading">
          <h3 className="settings-danger-title">Danger zone</h3>
          <p className="settings-danger-description">
            Sign out of this browser, or delete your account and everything in it.
          </p>
        </div>

        {signOutError ? (
          <InlineNotice tone="error" id="settings-signout-error">
            {signOutError}
          </InlineNotice>
        ) : null}

        <div className="cluster-2">
          <Button
            icon={<Icon name="log-out" />}
            loading={signOutPending}
            disabled={deletePending}
            aria-describedby={signOutError ? "settings-signout-error" : undefined}
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
          <Button
            variant="danger"
            disabled={signOutPending || deletePending}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </Button>
        </div>

        <ConfirmDialog
          open={confirmingDelete}
          title="Delete your account?"
          description="All of your account data, personal tasks, and projects you own will be permanently deleted. This action cannot be undone."
          confirmLabel="Delete account"
          danger
          busy={deletePending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void handleDeleteAccount()}
        >
          {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
        </ConfirmDialog>
      </section>
    </SettingsDetail>
  );
}

/* -------------------------------------------------------------------------
 * Project reminders
 * ---------------------------------------------------------------------- */

/** Reminder timing and delivery. The offset stays a draft until it blurs. */
export function RemindersPanel({ commit }) {
  const settings = useStore(selectSettings);
  const reminder = settings.reminder;
  const [defaultTime, setDefaultTime] = useState(reminder.defaultTime);

  useEffect(() => {
    setDefaultTime(reminder.defaultTime);
  }, [reminder.defaultTime]);

  return (
    <SettingsDetail
      title="Project reminders"
      description="Set reminder timing and delivery. Changes save automatically."
    >
      <div className="stack-4">
        <Field
          label="Remind me"
          htmlFor="settings-reminder-default-time"
          hint="Minutes before a task is due."
        >
          <span className="settings-number-field">
            <Input
              id="settings-reminder-default-time"
              type="number"
              min="1"
              max="1440"
              value={defaultTime}
              onChange={(event) => setDefaultTime(event.target.value)}
              onBlur={(event) =>
                void commit("reminder", { defaultTime: Number(event.target.value) }, "")
              }
            />
            <span className="settings-field-suffix">minutes before</span>
          </span>
        </Field>

        <div className="row-list">
          <ToggleRow
            label="In-app reminders"
            description="Show alerts in TaskFlow."
            checked={reminder.enableInAppReminders}
            onChange={(enableInAppReminders) =>
              void commit("reminder", { enableInAppReminders }, "")
            }
          />
          <ToggleRow
            label="Reminder sound"
            description="Play a sound for alerts."
            checked={reminder.enableSound}
            onChange={(enableSound) => void commit("reminder", { enableSound }, "")}
          />
        </div>
      </div>
    </SettingsDetail>
  );
}

/* -------------------------------------------------------------------------
 * Archived projects
 * ---------------------------------------------------------------------- */

/** Every archived project, with a one-click restore. */
export function ArchivedProjectsPanel() {
  const projects = useStore(selectProjects);
  const [pendingProjectId, setPendingProjectId] = useState("");
  const [message, setMessage] = useState(null);

  const archived = projects.filter((project) => project.status === "archived");

  const restore = async (project) => {
    setPendingProjectId(project.id);
    setMessage(null);
    const restored = await updateProject(project.id, { status: "active" });
    setPendingProjectId("");
    setMessage(
      restored
        ? { tone: "success", text: `${project.name} restored.` }
        : { tone: "error", text: `We couldn't restore ${project.name}. Try again.` }
    );
  };

  return (
    <SettingsDetail title="Archived projects" description="Projects you have archived.">
      {message ? <InlineNotice tone={message.tone}>{message.text}</InlineNotice> : null}

      {archived.length === 0 ? (
        <EmptyState
          icon="archive"
          title="No archived projects"
          description="Archived projects appear here."
        />
      ) : (
        <div className="row-list">
          {archived.map((project) => (
            <div className="settings-project-row" key={project.id}>
              <span className="settings-row-body">
                <span className="settings-row-label">{project.name}</span>
                {project.description ? (
                  <span className="settings-row-description truncate">
                    {project.description}
                  </span>
                ) : null}
              </span>
              <span className="cluster-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingProjectId === project.id}
                  onClick={() => navigate(`/projects/${encodeURIComponent(project.id)}`)}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  loading={pendingProjectId === project.id}
                  onClick={() => void restore(project)}
                >
                  Restore
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsDetail>
  );
}

/* -------------------------------------------------------------------------
 * Calendars
 * ---------------------------------------------------------------------- */

const otherProviders = CALENDAR_PROVIDERS.filter(({ id }) => id !== "google");

const formatSyncTime = (value) => {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not synced yet" : date.toLocaleString();
};

const SYNC_STATUS_LABELS = { error: "Needs attention", success: "Up to date" };

/** Why the OAuth consent screen sent us back without a connection. */
const CALLBACK_ERRORS = {
  authorization_denied: "Google Calendar access was cancelled. Nothing was connected.",
  invalid_or_expired_state: "This Google connection request expired. Please start again.",
  unknown: "Google Calendar could not be connected. Please try again.",
};

/**
 * Calendar connections. Google is a live integration (`api/calendar` plus the
 * store's synced events); the other providers are configuration-only until a
 * server-side connector exists.
 */
export function CalendarsPanel({ commit, saving = false, callback = null, onConnectedChange }) {
  const settings = useStore(selectSettings);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState(() =>
    callback?.status === "error"
      ? CALLBACK_ERRORS[callback.reason] || CALLBACK_ERRORS.unknown
      : ""
  );
  const [message, setMessage] = useState(() =>
    callback?.status === "connected" ? "Google Calendar connected." : ""
  );
  const [syncSummary, setSyncSummary] = useState(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [setupProviderId, setSetupProviderId] = useState("");
  const callbackSyncStartedRef = useRef(false);

  const connected = Boolean(connection);
  const failure = error || connection?.sync_error || "";
  const setupProvider = CALENDAR_PROVIDERS.find(({ id }) => id === setupProviderId);
  const missingSetupVariables = setupProvider
    ? calendarProviderSetup(setupProvider, import.meta.env).missingVariables
    : [];

  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  const loadConnection = useCallback(async () => {
    setLoading(true);
    try {
      setConnection(await getGoogleConnection());
      setError("");
    } catch {
      setError("Google Calendar connection status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  const sync = useCallback(async ({ afterConnect = false } = {}) => {
    setPendingAction("sync");
    setError("");
    if (!afterConnect) setMessage("");
    try {
      const result = await syncGoogleCalendar();
      const events = Array.isArray(result?.events) ? result.events : [];
      setGoogleEvents(events);
      setSyncSummary({
        calendarCount: result?.calendars?.length || 0,
        eventCount: events.length,
      });
      setConnection((current) =>
        current
          ? {
              ...current,
              last_synced_at: result?.lastSyncedAt,
              sync_status: "success",
              sync_error: null,
            }
          : current
      );
      setMessage(
        afterConnect ? "Google Calendar connected and synced." : "Google Calendar synced."
      );
    } catch (syncError) {
      setError(
        syncError?.message ||
          (afterConnect
            ? "Google Calendar connected, but events could not be synced."
            : "Google Calendar could not be synced.")
      );
    } finally {
      setPendingAction("");
    }
  }, []);

  // Returning from the OAuth callback: pull the newly authorized events in once.
  useEffect(() => {
    if (callback?.status !== "connected" || callbackSyncStartedRef.current) return;
    callbackSyncStartedRef.current = true;
    void sync({ afterConnect: true });
  }, [callback, sync]);

  const connect = async () => {
    setPendingAction("connect");
    setError("");
    setMessage("");
    try {
      await openExternalAuthorization(await startGoogleOAuth());
    } catch (connectionError) {
      setError(
        connectionError?.message || "Google Calendar connection could not be started."
      );
      setPendingAction("");
    }
  };

  const disconnect = async () => {
    setPendingAction("disconnect");
    setError("");
    setMessage("");
    try {
      await disconnectGoogleCalendar();
      setGoogleEvents([]);
      setConnection(null);
      setSyncSummary(null);
      setConfirmingDisconnect(false);
      setMessage("Google Calendar disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError?.message || "Google Calendar could not be disconnected."
      );
    } finally {
      setPendingAction("");
    }
  };

  return (
    <SettingsDetail
      title="Calendars"
      description="Connect a calendar to see its events in TaskFlow."
    >
      <div className="stack-4">
        <div className="settings-connection-card">
          <div className="settings-connection-header">
            <span className="settings-connection-name">Google Calendar</span>
            <Badge tone={connected ? "success" : "neutral"} dot>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </div>

          {loading ? (
            <p className="settings-connection-meta" role="status">
              <Spinner size="sm" aria-hidden="true" />
              Checking connection…
            </p>
          ) : connected ? (
            <dl className="settings-connection-meta">
              {[
                ["Account", connection.calendar_account_email || "Google account"],
                ["Sync status", SYNC_STATUS_LABELS[connection.sync_status] || "Ready"],
                ["Last sync", formatSyncTime(connection.last_synced_at)],
                syncSummary && [
                  "Latest result",
                  `${syncSummary.calendarCount} calendars · ${syncSummary.eventCount} events`,
                ],
              ]
                .filter(Boolean)
                .map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="settings-connection-meta">
              See your upcoming Google events in TaskFlow.
            </p>
          )}

          <div className="settings-connection-actions">
            {connected ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  loading={pendingAction === "sync"}
                  disabled={Boolean(pendingAction)}
                  onClick={() => void sync()}
                >
                  Sync now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pendingAction === "disconnect"}
                  disabled={Boolean(pendingAction)}
                  onClick={() => setConfirmingDisconnect(true)}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={pendingAction === "connect"}
                disabled={loading || Boolean(pendingAction)}
                onClick={() => void connect()}
              >
                Connect Google
              </Button>
            )}
          </div>

          {failure ? (
            <InlineNotice
              tone="error"
              action={
                pendingAction ? null : (
                  <Button size="sm" onClick={() => void loadConnection()}>
                    Retry
                  </Button>
                )
              }
            >
              {failure}
            </InlineNotice>
          ) : null}
          {message ? <InlineNotice tone="success">{message}</InlineNotice> : null}

          <ConfirmDialog
            open={confirmingDisconnect}
            title="Disconnect Google Calendar?"
            description="Synced events are removed from TaskFlow. Your Google Calendar stays unchanged."
            confirmLabel="Disconnect"
            danger
            busy={pendingAction === "disconnect"}
            onCancel={() => setConfirmingDisconnect(false)}
            onConfirm={() => void disconnect()}
          />
        </div>

        <div className="row-list">
          {otherProviders.map((provider) => {
            const providerConnection = settings.calendarConnections[provider.id];

            return (
              <div className="settings-provider-row" key={provider.id}>
                <span className="settings-row-body">
                  <span className="settings-row-label">{provider.name}</span>
                  <span className="settings-row-description">
                    {providerConnection.connected
                      ? providerConnection.accountLabel || "Connected account"
                      : "Setup required"}
                  </span>
                </span>
                <Badge tone={providerConnection.connected ? "success" : "neutral"} dot>
                  {providerConnection.connected ? "Connected" : "Not connected"}
                </Badge>
                {providerConnection.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() =>
                      void commit(
                        "calendarConnections",
                        { [provider.id]: emptyCalendarConnection() },
                        `${provider.name} disconnected.`
                      )
                    }
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setSetupProviderId(provider.id)}>
                    Set up
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {setupProvider ? (
        <Dialog
          open
          size="sm"
          title={`Connect ${setupProvider.name}`}
          onClose={() => setSetupProviderId("")}
          footer={
            <Button variant="primary" disabled>
              Authorization unavailable
            </Button>
          }
        >
          <div className="stack-3">
            <p>{setupProvider.name} setup is not available yet.</p>
            {missingSetupVariables.length > 0 ? (
              <div className="settings-requirements">
                <p className="settings-requirements-title">Required configuration</p>
                <ul>
                  {missingSetupVariables.map((variableName) => (
                    <li key={variableName}>
                      <code>{variableName}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted">{setupProvider.setup}</p>
            <p className="muted">Keep provider credentials server-side.</p>
          </div>
        </Dialog>
      ) : null}
    </SettingsDetail>
  );
}
