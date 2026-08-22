import { SettingsDetail, ToggleRow } from "./SettingsControls";

export default function ProjectRemindersPanel({
  reminder,
  onBack,
  onDefaultTimeChange,
  onInAppRemindersChange,
  onSoundChange,
}) {
  return (
    <SettingsDetail
      title="Project Reminders"
      description="TaskFlow currently supports a shared reminder default, not project-specific policies."
      onBack={onBack}
    >
      <div className="settings-reminder-preferences">
        <label className="settings-inline-field">
          <span>Default reminder (minutes before)</span>
          <input
            type="number"
            min="1"
            max="1440"
            value={reminder.defaultTime}
            onChange={(event) => onDefaultTimeChange(Number(event.target.value))}
          />
        </label>
        <ToggleRow
          label="In-app reminders"
          description="Show TaskFlow reminders while the app is open."
          checked={reminder.enableInAppReminders}
          onChange={onInAppRemindersChange}
        />
        <ToggleRow
          label="Reminder sound"
          description="Play a subtle sound for delivered reminders."
          checked={reminder.enableSound}
          onChange={onSoundChange}
        />
      </div>
    </SettingsDetail>
  );
}
