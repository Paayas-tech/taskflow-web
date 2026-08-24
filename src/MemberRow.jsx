import { safeDisplayName } from "./domain/identityDomain";

export default function MemberRow({
  member,
  ownerId,
  canManage,
  busy,
  onRoleChange,
  onRemove,
}) {
  const isOwner = member.userId === ownerId || member.role === "owner";
  const displayName = safeDisplayName(member);

  return (
    <article className="project-card" aria-label={`${displayName}, ${member.role}`}>
      <div className="project-card-heading">
        <div>
          <h3>{displayName}</h3>
          <span className={`project-status project-status-${member.role}`}>
            {isOwner ? "Owner" : member.role === "editor" ? "Editor" : "Viewer"}
          </span>
        </div>
      </div>
      {!isOwner && canManage && (
        <div className="project-card-actions">
          <label className="project-form-field">
            <span>Role</span>
            <select
              value={member.role}
              disabled={busy}
              onChange={(event) => onRoleChange(member, event.target.value)}
              aria-label={`Role for ${displayName}`}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            className="danger-btn compact-btn"
            type="button"
            disabled={busy}
            onClick={(event) => onRemove(member, event.currentTarget)}
          >
            Remove
          </button>
        </div>
      )}
    </article>
  );
}
