import { Avatar, Badge, Icon, IconButton, Select } from "../ui";
import { safeDisplayName } from "../domain/identityDomain";

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

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
  const roleLabel = isOwner ? roleLabels.owner : roleLabels[member.role] || member.role;
  const editable = canManage && !isOwner;

  return (
    <article className="member-row" aria-label={`${displayName}, ${member.role}`}>
      <Avatar name={displayName} src={member.avatarUrl || ""} size="md" />
      <div className="member-main">
        <span className="member-name truncate">{displayName}</span>
        {member.email ? <span className="member-email truncate">{member.email}</span> : null}
      </div>
      {editable ? (
        <Select
          className="member-role"
          value={member.role}
          disabled={busy}
          aria-label={`Role for ${displayName}`}
          onChange={(event) => onRoleChange(member, event.target.value)}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </Select>
      ) : (
        <Badge tone={isOwner ? "accent" : "neutral"}>{roleLabel}</Badge>
      )}
      {editable ? (
        <IconButton
          label={`Remove ${displayName}`}
          size="sm"
          disabled={busy}
          onClick={(event) => onRemove(member, event.currentTarget)}
        >
          <Icon name="trash" />
        </IconButton>
      ) : null}
    </article>
  );
}
