import { Badge, Button } from "../ui";
import { safeDisplayName } from "../domain/identityDomain";

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const invitationExpired = (invitation) =>
  invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now();

const sentenceCase = (value) => {
  const text = String(value || "").trim();
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
};

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
  const roleLabel = roleLabels[invitation.role] || sentenceCase(invitation.role);
  const statusLabel = expired && invitation.status === "pending"
    ? "Expired"
    : sentenceCase(invitation.status);

  return (
    <article className="invitation-row">
      <div className="invitation-main">
        <span className="invitation-title truncate">
          {incoming ? projectName : invitation.email}
        </span>
        <span className="invitation-meta">
          {incoming ? `Invited by ${inviterName} · ${roleLabel}` : `${roleLabel} · ${statusLabel}`}
        </span>
      </div>
      {incoming && expired ? <Badge tone="danger">Expired</Badge> : null}
      <div className="invitation-actions">
        {incoming ? (
          <>
            <Button
              variant="primary"
              size="sm"
              disabled={expired}
              loading={busy}
              onClick={() => onAccept(invitation)}
            >
              Accept
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDecline(invitation)}>
              Decline
            </Button>
          </>
        ) : invitation.status === "pending" ? (
          <Button variant="ghost" size="sm" loading={busy} onClick={() => onCancel(invitation)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}
