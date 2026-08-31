import { SettingsDetail, UnavailableProviders } from "./SettingsControls";

const formatSyncTime = (value) => {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not synced yet" : date.toLocaleString();
};

export default function GoogleCalendarIntegrationPanel({
  connection,
  loading,
  pendingAction,
  error,
  message,
  syncSummary,
  onBack,
  onConnect,
  onSync,
  onDisconnect,
  onRetry,
}) {
  const connected = Boolean(connection);
  return (
    <SettingsDetail title="Integrations" onBack={onBack}>
      <div className="settings-integrations-list">
        <section className="settings-google-integration" aria-labelledby="google-calendar-integration-title">
          <div className="settings-google-integration-heading">
            <span className="settings-google-mark" aria-hidden="true">G</span>
            <div>
              <h3 id="google-calendar-integration-title">Google Calendar</h3>
              <p>{connected ? connection.calendar_account_email || "Connected Google account" : "Bring upcoming events into TaskFlow."}</p>
            </div>
            <span className={`settings-integration-status ${connected ? "is-connected" : ""}`}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>

          {loading ? (
            <div className="settings-integration-loading" role="status">Checking connection…</div>
          ) : connected ? (
            <div className="settings-google-connected">
              <dl>
                <div><dt>Sync status</dt><dd>{connection.sync_status === "error" ? "Needs attention" : connection.sync_status === "success" ? "Up to date" : "Ready"}</dd></div>
                <div><dt>Last sync</dt><dd>{formatSyncTime(connection.last_synced_at)}</dd></div>
                {syncSummary && (
                  <div><dt>Latest result</dt><dd>{syncSummary.calendarCount} calendars · {syncSummary.eventCount} events</dd></div>
                )}
              </dl>
              <div className="settings-integration-actions">
                <button className="primary-btn compact-btn" type="button" onClick={onSync} disabled={Boolean(pendingAction)}>
                  {pendingAction === "sync" ? "Syncing…" : "Sync now"}
                </button>
                <button className="ghost-btn compact-btn" type="button" onClick={onDisconnect} disabled={Boolean(pendingAction)}>
                  {pendingAction === "disconnect" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          ) : (
            <button className="primary-btn settings-google-connect" type="button" onClick={onConnect} disabled={Boolean(pendingAction)}>
              {pendingAction === "connect" ? "Opening Google…" : "Connect Google Calendar"}
            </button>
          )}

          {(error || connection?.sync_error) && (
            <div className="settings-integration-error" role="alert">
              <span>{error || connection.sync_error}</span>
              {!pendingAction && <button type="button" onClick={onRetry}>Retry</button>}
            </div>
          )}
          {message && <p className="settings-integration-message" role="status">{message}</p>}
        </section>

        <div className="settings-other-integrations">
          <UnavailableProviders providers={["Microsoft Outlook", "iCloud"]} />
        </div>
      </div>
    </SettingsDetail>
  );
}
