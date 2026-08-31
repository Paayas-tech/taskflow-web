import { CALENDAR_PROVIDERS } from "../domain/calendarConnectionDomain";
import { SettingsDetail } from "./SettingsControls";

export default function CalendarConnectionSection({
  settings,
  saving,
  googleConnection,
  googleLoading = false,
  googlePendingAction = "",
  googleError = "",
  googleMessage = "",
  googleSyncSummary,
  selectedProvider,
  setup,
  dialogRef,
  onBackdropMouseDown,
  onBack,
  onConnect,
  onDisconnect,
  onConnectGoogle,
  onSyncGoogle,
  onDisconnectGoogle,
  confirmingGoogleDisconnect = false,
  onRequestGoogleDisconnect,
  onCancelGoogleDisconnect,
  onRetryGoogle,
  onCloseSetup,
}) {
  return (
    <SettingsDetail
      title="Calendar Settings"
      description="Connect Google Calendar to securely bring upcoming events into TaskFlow."
      onBack={onBack}
    >
      <div className="settings-compact-list settings-calendar-providers">
        {CALENDAR_PROVIDERS.map((provider) => {
          if (provider.id === "google") {
            const connected = Boolean(googleConnection);
            return (
              <div className="settings-provider-row settings-provider-row-google" key={provider.id}>
                <span>
                  <strong>{provider.name}</strong>
                  <small>
                    {googleLoading
                      ? "Checking connection…"
                      : connected
                        ? googleConnection.calendar_account_email || "Connected Google account"
                        : "Not connected"}
                  </small>
                  {connected && googleConnection.last_synced_at && (
                    <small>Last synced {new Date(googleConnection.last_synced_at).toLocaleString()}</small>
                  )}
                  {connected && googleSyncSummary && (
                    <small>{googleSyncSummary.calendarCount} calendars · {googleSyncSummary.eventCount} events</small>
                  )}
                </span>
                <div className="settings-calendar-provider-actions">
                  {connected ? (
                    <>
                      <button className="primary-btn compact-btn" type="button" onClick={onSyncGoogle} disabled={Boolean(googlePendingAction)}>
                        {googlePendingAction === "sync" ? "Syncing…" : "Sync now"}
                      </button>
                      <button className="ghost-btn compact-btn" type="button" onClick={onRequestGoogleDisconnect} disabled={Boolean(googlePendingAction)}>
                        {googlePendingAction === "disconnect" ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </>
                  ) : (
                    <button className="primary-btn compact-btn" type="button" onClick={onConnectGoogle} disabled={googleLoading || Boolean(googlePendingAction)}>
                      {googlePendingAction === "connect" ? "Opening Google…" : "Connect Google"}
                    </button>
                  )}
                </div>
              </div>
            );
          }
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
                  onClick={() => onDisconnect(provider)}
                  disabled={saving}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="ghost-btn compact-btn"
                  type="button"
                  onClick={() => onConnect(provider.id)}
                >
                  Setup required
                </button>
              )}
            </div>
          );
        })}
      </div>

      {googleError && (
        <div className="settings-integration-error settings-calendar-feedback" role="alert">
          <span>{googleError}</span>
          {!googlePendingAction && <button type="button" onClick={onRetryGoogle}>Retry</button>}
        </div>
      )}
      {googleMessage && <p className="settings-integration-message settings-calendar-feedback" role="status">{googleMessage}</p>}

      {confirmingGoogleDisconnect && (
        <div className="confirmation-backdrop">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="google-disconnect-title" aria-describedby="google-disconnect-description">
            <p className="card-label">Calendar connection</p>
            <h3 id="google-disconnect-title">Disconnect Google Calendar?</h3>
            <p id="google-disconnect-description">Google events will be removed from TaskFlow. Your Google Calendar events will not be deleted.</p>
            <div className="confirmation-actions">
              <button className="ghost-btn" type="button" onClick={onCancelGoogleDisconnect} disabled={Boolean(googlePendingAction)}>Cancel</button>
              <button className="danger-btn" type="button" onClick={onDisconnectGoogle} disabled={Boolean(googlePendingAction)}>{googlePendingAction === "disconnect" ? "Disconnecting…" : "Disconnect"}</button>
            </div>
          </section>
        </div>
      )}

      {selectedProvider && setup && (
        <div className="settings-connection-backdrop" onMouseDown={onBackdropMouseDown}>
          <section
            ref={dialogRef}
            className="settings-connection-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-connection-title"
          >
            <header>
              <div>
                <p className="card-label">Calendar connection</p>
                <h3 id="calendar-connection-title">Connect {selectedProvider.name}</h3>
              </div>
              <button
                className="ghost-btn compact-btn"
                type="button"
                onClick={onCloseSetup}
                aria-label="Close calendar connection setup"
              >
                Close
              </button>
            </header>
            <div className="settings-connection-content">
              <p>
                {selectedProvider.name} cannot be connected yet because its secure
                server-side authorization flow has not been implemented.
              </p>
              {setup.missingVariables.length > 0 && (
                <div className="settings-connection-requirements">
                  <strong>Required configuration</strong>
                  <ul>
                    {setup.missingVariables.map((variableName) => (
                      <li key={variableName}><code>{variableName}</code></li>
                    ))}
                  </ul>
                </div>
              )}
              <p>{selectedProvider.setup}</p>
              <p className="settings-connection-security-note">
                Client secrets, access tokens, refresh tokens, passwords, and Apple
                app-specific passwords must not be stored in Vite variables or TaskFlow local settings.
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
