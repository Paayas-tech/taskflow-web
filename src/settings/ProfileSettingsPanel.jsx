import { Avatar, Button, Field, Input } from "../ui";
import { SettingsDetail } from "./SettingsControls";
import SettingsSignOutSection from "./SettingsSignOutSection";

export default function ProfileSettingsPanel({
  settings,
  saving = false,
  error = "",
  onChange,
  onSave,
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
  const displayName = settings.profile.displayName;
  const email = settings.profile.email;

  return (
    <SettingsDetail title="Profile" description="Your name is visible to project members.">
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave?.();
        }}
      >
        <div className="settings-identity">
          <Avatar name={displayName || email} size="lg" />
          <div className="settings-identity-body">
            <span className="settings-identity-name">{displayName || "TaskFlow user"}</span>
            <span className="settings-identity-email">{email}</span>
          </div>
        </div>

        <Field label="Display name" htmlFor="settings-display-name" error={error}>
          <Input
            id="settings-display-name"
            maxLength={80}
            placeholder="Enter your name"
            value={displayName}
            disabled={saving}
            invalid={Boolean(error)}
            onChange={(event) =>
              onChange({
                ...settings,
                profile: { ...settings.profile, displayName: event.target.value },
              })
            }
          />
        </Field>

        <Field
          label="Email"
          htmlFor="settings-email"
          hint="Your sign-in email is managed by your account."
        >
          <Input id="settings-email" type="email" value={email} readOnly disabled />
        </Field>

        <div className="settings-form-actions">
          <Button variant="primary" type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>

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
    </SettingsDetail>
  );
}
