import { Field, Input } from "../ui";
import { SettingsDetail, ToggleRow } from "./SettingsControls";

export default function ProjectRemindersPanel({
  reminder,
  onDefaultTimeChange,
  onDefaultTimeCommit,
  onInAppRemindersChange,
  onSoundChange,
}) {
  return (
    <SettingsDetail
      title="Project reminders"
      description="Set reminder timing and delivery. Changes save automatically."
    >
      <div className="stack-4">
        <Field
          label="Remind me"
          htmlFor="settings-reminder-default-time"
          hint="Minutes before a task is due."
        >
          <span className="settings-number-field">
            <Input
              id="settings-reminder-default-time"
              type="number"
              min="1"
              max="1440"
              value={reminder.defaultTime}
              onChange={(event) => onDefaultTimeChange(Number(event.target.value))}
              onBlur={(event) => onDefaultTimeCommit(Number(event.target.value))}
            />
            <span className="settings-field-suffix">minutes before</span>
          </span>
        </Field>

        <div className="row-list">
          <ToggleRow
            label="In-app reminders"
            description="Show alerts in TaskFlow."
            checked={reminder.enableInAppReminders}
            onChange={onInAppRemindersChange}
          />
          <ToggleRow
            label="Reminder sound"
            description="Play a sound for alerts."
            checked={reminder.enableSound}
            onChange={onSoundChange}
          />
        </div>
      </div>
    </SettingsDetail>
  );
}
