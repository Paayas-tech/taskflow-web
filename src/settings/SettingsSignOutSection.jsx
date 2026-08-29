export default function SettingsSignOutSection({
  onSignOut,
  pending,
  error,
  onDeleteAccount,
  deletePending = false,
  deleteError = "",
  confirmingDelete = false,
  onBeginDelete,
  onCancelDelete,
}) {
  return (
    <div className="settings-signout-row">
      <div className="settings-account-actions">
        <button
          className="ghost-btn settings-signout"
          type="button"
          onClick={onSignOut}
          disabled={pending || deletePending}
          aria-busy={pending}
          aria-describedby={error ? "settings-signout-error" : undefined}
        >
          {pending ? "Signing out..." : "Sign out"}
        </button>
        <button
          className="settings-delete-trigger"
          type="button"
          onClick={onBeginDelete}
          disabled={pending || deletePending}
        >
          Delete account
        </button>
      </div>
      {error && (
        <p className="signout-error" id="settings-signout-error" role="alert">
          {error}
        </p>
      )}

      {confirmingDelete && (
        <div
          className="settings-delete-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletePending) {
              onCancelDelete?.();
            }
          }}
        >
          <section
            className="settings-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
          >
            <div className="settings-delete-warning-icon" aria-hidden="true">!</div>
            <div>
              <p className="settings-delete-kicker">Permanent action</p>
              <h2 id="delete-account-title">Delete your TaskFlow account?</h2>
              <p id="delete-account-description">
                All of your account data, personal tasks, and projects you own
                will be permanently deleted. This action cannot be undone.
              </p>
            </div>
            {deleteError && <p className="signout-error" role="alert">{deleteError}</p>}
            <div className="settings-delete-actions">
              <button className="ghost-btn" type="button" onClick={onCancelDelete} disabled={deletePending}>
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={onDeleteAccount}
                disabled={deletePending}
                aria-busy={deletePending}
              >
                {deletePending ? "Deleting account…" : "Permanently delete account"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
