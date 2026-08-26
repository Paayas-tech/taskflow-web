export default function SettingsSignOutSection({ onSignOut, pending, error }) {
  return (
    <div className="settings-signout-row">
      <button
        className="ghost-btn settings-signout"
        type="button"
        onClick={onSignOut}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? "settings-signout-error" : undefined}
      >
        {pending ? "Signing out..." : "Sign out of TaskFlow"}
      </button>
      {error && (
        <p className="signout-error" id="settings-signout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
