import { SettingsDetail } from "./SettingsControls";

export default function ProfileSettingsPanel({ settings, saving, onChange, onBack }) {
  return (
    <SettingsDetail
      title="My Profile"
      description="Account details shown by TaskFlow."
      onBack={onBack}
      headerAction={(
        <button className="primary-btn compact-btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      )}
    >
      <div className="settings-profile-panel">
        <div className="settings-profile-summary" aria-label="Profile avatar">
          <span aria-hidden="true">
            {(settings.profile.displayName || settings.profile.email)?.[0]?.toUpperCase() || "U"}
          </span>
          <p>TaskFlow currently uses your initial. Custom avatar uploads are not supported.</p>
        </div>
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
            placeholder="How TaskFlow should address you"
            disabled={saving}
          />
        </label>
        <label className="settings-field">
          <span>Email</span>
          <input type="email" value={settings.profile.email} disabled readOnly />
          <small>Email is managed by your TaskFlow authentication account.</small>
        </label>
      </div>
    </SettingsDetail>
  );
}
