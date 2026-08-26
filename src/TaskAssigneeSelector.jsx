import { safeDisplayName } from "./domain/identityDomain";

export default function TaskAssigneeSelector({
  assigneeId,
  members = [],
  disabled = false,
  busy = false,
  error = "",
  onChange,
}) {
  return (
    <section className="settings-section task-assignee-section" aria-labelledby="task-assignee-title">
      <div className="task-assignee-row">
        <div>
          <p className="card-label">Collaboration</p>
          <h3 id="task-assignee-title">Assignee</h3>
        </div>
        <label className="task-assignee-control">
          <span>Project member</span>
          <select
            value={assigneeId || ""}
            onChange={(event) => onChange?.(event.target.value || null)}
            disabled={disabled || busy}
            aria-busy={busy}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {safeDisplayName(member)} · {member.role}
              </option>
            ))}
          </select>
        </label>
      </div>
      {disabled && <p className="form-hint">Viewers can see the assignee but cannot change it.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
