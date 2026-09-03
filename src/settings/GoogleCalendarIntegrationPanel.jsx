import { Badge, Button, ConfirmDialog, InlineNotice, Spinner } from "../ui";

const formatSyncTime = (value) => {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not synced yet" : date.toLocaleString();
};

const syncStatusLabel = (status) => {
  if (status === "error") return "Needs attention";
  if (status === "success") return "Up to date";
  return "Ready";
};

/** Google Calendar connection card: status, sync details and the connect actions. */
export default function GoogleCalendarIntegrationPanel({
  connection,
  loading = false,
  pendingAction = "",
  error = "",
  message = "",
  syncSummary,
  confirmingDisconnect = false,
  onConnect,
  onSync,
  onRequestDisconnect,
  onCancelDisconnect,
  onDisconnect,
  onRetry,
}) {
  const connected = Boolean(connection);
  const failure = error || connection?.sync_error || "";

  return (
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
          <div>
            <dt>Account</dt>
            <dd>{connection.calendar_account_email || "Google account"}</dd>
          </div>
          <div>
            <dt>Sync status</dt>
            <dd>{syncStatusLabel(connection.sync_status)}</dd>
          </div>
          <div>
            <dt>Last sync</dt>
            <dd>{formatSyncTime(connection.last_synced_at)}</dd>
          </div>
          {syncSummary ? (
            <div>
              <dt>Latest result</dt>
              <dd>
                {syncSummary.calendarCount} calendars · {syncSummary.eventCount} events
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="settings-connection-meta">See your upcoming Google events in TaskFlow.</p>
      )}

      <div className="settings-connection-actions">
        {connected ? (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={pendingAction === "sync"}
              disabled={Boolean(pendingAction)}
              onClick={onSync}
            >
              Sync now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={pendingAction === "disconnect"}
              disabled={Boolean(pendingAction)}
              onClick={onRequestDisconnect}
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
            onClick={onConnect}
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
              <Button size="sm" onClick={onRetry}>
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
        onCancel={onCancelDisconnect}
        onConfirm={onDisconnect}
      />
    </div>
  );
}
