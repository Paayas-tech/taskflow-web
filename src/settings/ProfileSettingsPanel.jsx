import { SettingsDetail } from "./SettingsControls";
import SettingsSignOutSection from "./SettingsSignOutSection";

export default function ProfileSettingsPanel({
  settings,
  saving,
  onChange,
  onBack,
  onSignOut,
  signOutPending = false,
  signOutError = "",
  onDeleteAccount,
  deleteAccountPending = false,
  deleteAccountError = "",
  confirmingDelete = false,
  onBeginDelete,
  onCancelDelete,
}) {
  return (
    <SettingsDetail
      title="My Profile"
      onBack={onBack}
      headerAction={(
        <button className="primary-btn compact-btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      )}
    >
      <div className="settings-profile-panel">
        <section className="settings-profile-identity" aria-label="Profile summary">
          <span className="settings-profile-avatar" aria-hidden="true">
            {(settings.profile.displayName || settings.profile.email)?.[0]?.toUpperCase() || "U"}
          </span>
          <div>
            <h3>{settings.profile.displayName || "TaskFlow user"}</h3>
            <p>{settings.profile.email}</p>
            <span className="settings-profile-status"><i aria-hidden="true" /> Signed in</span>
          </div>
        </section>

        <section className="settings-profile-information" aria-labelledby="profile-information-title">
          <header>
            <div>
              <h3 id="profile-information-title">Profile information</h3>
            </div>
          </header>
          <div className="settings-profile-fields">
            <label className="settings-field">
              <span>Display name</span>
              <input
                type="text"
                maxLength="80"
                value={settings.profile.displayName}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    profile: { ...settings.profile, displayName: event.target.value },
                  })
                }
                placeholder="Enter your name"
                disabled={saving}
              />
            </label>
            <label className="settings-field settings-profile-email-field">
              <span>Email address</span>
              <div>
                <input type="email" value={settings.profile.email} disabled readOnly />
                <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
              </div>
            </label>
          </div>
        </section>

        <SettingsSignOutSection
          onSignOut={onSignOut}
          pending={signOutPending}
          error={signOutError}
          onDeleteAccount={onDeleteAccount}
          deletePending={deleteAccountPending}
          deleteError={deleteAccountError}
          confirmingDelete={confirmingDelete}
          onBeginDelete={onBeginDelete}
          onCancelDelete={onCancelDelete}
        />
      </div>
    </SettingsDetail>
  );
}
