import { safeDisplayName } from "./domain/identityDomain";

const invitationExpired = (invitation) =>
  invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now();

export default function InvitationRow({
  invitation,
  incoming = false,
  busy = false,
  onAccept,
  onDecline,
  onCancel,
}) {
  const expired = invitationExpired(invitation);
  const projectName = invitation.project?.name || "Project invitation";
  const inviterName = safeDisplayName({ displayName: invitation.inviterDisplayName });

  return (
    <article className="project-card">
      <div className="project-card-heading">
        <div>
          <h3>{incoming ? projectName : invitation.email}</h3>
          <span className={`project-status project-status-${invitation.status}`}>
            {expired && invitation.status === "pending" ? "Expired" : invitation.status}
          </span>
        </div>
      </div>
      <p className="project-description">
        {incoming
          ? `${invitation.role === "editor" ? "Editor" : "Viewer"} access from ${inviterName}`
          : `${invitation.role === "editor" ? "Editor" : "Viewer"} access`}
      </p>
      <div className="project-card-actions">
        {incoming ? (
          <>
            <button
              className="primary-btn compact-btn"
              type="button"
              disabled={busy || expired}
              onClick={() => onAccept(invitation)}
            >
              {busy ? "Working..." : "Accept"}
            </button>
            <button
              className="ghost-btn compact-btn"
              type="button"
              disabled={busy}
              onClick={() => onDecline(invitation)}
            >
              Decline
            </button>
          </>
        ) : invitation.status === "pending" ? (
          <button
            className="ghost-btn compact-btn"
            type="button"
            disabled={busy}
            onClick={() => onCancel(invitation)}
          >
            Cancel invitation
          </button>
        ) : null}
      </div>
    </article>
  );
}
