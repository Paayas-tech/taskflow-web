import { Button, ConfirmDialog, Icon, InlineNotice } from "../ui";

export default function SettingsSignOutSection({
  onSignOut,
  pending = false,
  error = "",
  onDeleteAccount,
  deletePending = false,
  deleteError = "",
  confirmingDelete = false,
  onBeginDelete,
  onCancelDelete,
}) {
  return (
    <section className="settings-danger" aria-label="Account actions">
      <div className="settings-danger-heading">
        <h3 className="settings-danger-title">Danger zone</h3>
        <p className="settings-danger-description">
          Sign out of this browser, or delete your account and everything in it.
        </p>
      </div>

      {error ? (
        <InlineNotice tone="error" id="settings-signout-error">
          {error}
        </InlineNotice>
      ) : null}

      <div className="cluster-2">
        <Button
          icon={<Icon name="log-out" />}
          loading={pending}
          disabled={deletePending}
          aria-describedby={error ? "settings-signout-error" : undefined}
          onClick={onSignOut}
        >
          Sign out
        </Button>
        <Button variant="danger" disabled={pending || deletePending} onClick={onBeginDelete}>
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
        onCancel={onCancelDelete}
        onConfirm={onDeleteAccount}
      >
        {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
      </ConfirmDialog>
    </section>
  );
}
