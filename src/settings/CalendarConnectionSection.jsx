import { CALENDAR_PROVIDERS } from "../domain/calendarConnectionDomain";
import { SettingsDetail } from "./SettingsControls";

export default function CalendarConnectionSection({
  settings,
  saving,
  selectedProvider,
  setup,
  dialogRef,
  onBackdropMouseDown,
  onBack,
  onConnect,
  onDisconnect,
  onCloseSetup,
}) {
  return (
    <SettingsDetail
      title="Calendar Settings"
      description="Connect controls show the exact provider configuration TaskFlow still requires."
      onBack={onBack}
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
                  onClick={() => onDisconnect(provider)}
                  disabled={saving}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="secondary-btn compact-btn"
                  type="button"
                  onClick={() => onConnect(provider.id)}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

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
                TaskFlow cannot start this authorization securely until its
                provider configuration and server-side token handler are available.
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
