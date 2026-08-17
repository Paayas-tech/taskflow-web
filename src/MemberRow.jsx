export default function MemberRow({
  member,
  ownerId,
  canManage,
  busy,
  onRoleChange,
  onRemove,
}) {
  const isOwner = member.userId === ownerId || member.role === "owner";

  return (
    <article className="project-card" aria-label={`${member.userId}, ${member.role}`}>
      <div className="project-card-heading">
        <div>
          <h3>{member.userId}</h3>
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
              aria-label={`Role for ${member.userId}`}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            className="danger-btn compact-btn"
            type="button"
            disabled={busy}
            onClick={() => onRemove(member)}
          >
            Remove
          </button>
        </div>
      )}
    </article>
  );
}
