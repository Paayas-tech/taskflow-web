import { SettingsDetail, ToggleRow } from "./SettingsControls";

export default function ProjectRemindersPanel({
  reminder,
  onBack,
  onDefaultTimeChange,
  onDefaultTimeCommit,
  onInAppRemindersChange,
  onSoundChange,
}) {
  return (
    <SettingsDetail
      title="Project Reminders"
      description="Choose how TaskFlow reminds you about upcoming work. Changes save automatically."
      onBack={onBack}
    >
      <div className="settings-reminder-preferences">
        <section className="settings-reminder-card" aria-labelledby="reminder-timing-title">
          <div className="settings-reminder-card-heading">
            <h3 id="reminder-timing-title">Reminder timing</h3>
            <p>Used as the default when you add a reminder to a task.</p>
          </div>
          <label className="settings-reminder-time-field">
            <span>Remind me</span>
            <span className="settings-reminder-time-input">
              <input
                type="number"
                min="1"
                max="1440"
                value={reminder.defaultTime}
                onChange={(event) => onDefaultTimeChange(Number(event.target.value))}
                onBlur={(event) => onDefaultTimeCommit(Number(event.target.value))}
              />
              <small>minutes before</small>
            </span>
          </label>
        </section>

        <section className="settings-reminder-card settings-reminder-delivery" aria-labelledby="reminder-delivery-title">
          <div className="settings-reminder-card-heading">
            <h3 id="reminder-delivery-title">Delivery</h3>
            <p>Control how reminders get your attention.</p>
          </div>
          <div className="settings-reminder-toggle-list">
            <ToggleRow
              label="In-app reminders"
              description="Show reminders while TaskFlow is open."
              checked={reminder.enableInAppReminders}
              onChange={onInAppRemindersChange}
            />
            <ToggleRow
              label="Reminder sound"
              description="Play a subtle sound when a reminder arrives."
              checked={reminder.enableSound}
              onChange={onSoundChange}
            />
          </div>
        </section>
      </div>
    </SettingsDetail>
  );
}
