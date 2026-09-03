import { Badge, Button, Dialog } from "../ui";
import { CALENDAR_PROVIDERS } from "../domain/calendarConnectionDomain";
import { SettingsDetail } from "./SettingsControls";
import GoogleCalendarIntegrationPanel from "./GoogleCalendarIntegrationPanel";

const otherProviders = CALENDAR_PROVIDERS.filter(({ id }) => id !== "google");

export default function CalendarConnectionSection({
  settings,
  saving = false,
  googleConnection,
  googleLoading = false,
  googlePendingAction = "",
  googleError = "",
  googleMessage = "",
  googleSyncSummary,
  confirmingGoogleDisconnect = false,
  selectedProvider,
  setup,
  onConnect,
  onDisconnect,
  onConnectGoogle,
  onSyncGoogle,
  onRequestGoogleDisconnect,
  onCancelGoogleDisconnect,
  onDisconnectGoogle,
  onRetryGoogle,
  onCloseSetup,
}) {
  return (
    <SettingsDetail title="Calendars" description="Connect a calendar to see its events in TaskFlow.">
      <div className="stack-4">
        <GoogleCalendarIntegrationPanel
          connection={googleConnection}
          loading={googleLoading}
          pendingAction={googlePendingAction}
          error={googleError}
          message={googleMessage}
          syncSummary={googleSyncSummary}
          confirmingDisconnect={confirmingGoogleDisconnect}
          onConnect={onConnectGoogle}
          onSync={onSyncGoogle}
          onRequestDisconnect={onRequestGoogleDisconnect}
          onCancelDisconnect={onCancelGoogleDisconnect}
          onDisconnect={onDisconnectGoogle}
          onRetry={onRetryGoogle}
        />

        <div className="row-list">
          {otherProviders.map((provider) => {
            const connection = settings.calendarConnections[provider.id];

            return (
              <div className="settings-provider-row" key={provider.id}>
                <span className="settings-row-body">
                  <span className="settings-row-label">{provider.name}</span>
                  <span className="settings-row-description">
                    {connection.connected
                      ? connection.accountLabel || "Connected account"
                      : "Setup required"}
                  </span>
                </span>
                <Badge tone={connection.connected ? "success" : "neutral"} dot>
                  {connection.connected ? "Connected" : "Not connected"}
                </Badge>
                {connection.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => onDisconnect(provider)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onConnect(provider.id)}>
                    Set up
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedProvider && setup ? (
        <Dialog
          open
          size="sm"
          title={`Connect ${selectedProvider.name}`}
          onClose={onCloseSetup}
          footer={
            <Button variant="primary" disabled>
              Authorization unavailable
            </Button>
          }
        >
          <div className="stack-3">
            <p>{selectedProvider.name} setup is not available yet.</p>
            {setup.missingVariables.length > 0 ? (
              <div className="settings-requirements">
                <p className="settings-requirements-title">Required configuration</p>
                <ul>
                  {setup.missingVariables.map((variableName) => (
                    <li key={variableName}>
                      <code>{variableName}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted">{selectedProvider.setup}</p>
            <p className="muted">Keep provider credentials server-side.</p>
          </div>
        </Dialog>
      ) : null}
    </SettingsDetail>
  );
}
