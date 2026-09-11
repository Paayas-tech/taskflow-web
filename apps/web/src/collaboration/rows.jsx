/**
 * The four small rows the collaboration surfaces render: a comment, an activity
 * event, a project member and an invitation. They are presentational — every
 * mutation is handed to them as a callback by the surface that owns the data.
 */
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Icon,
  IconButton,
  Menu,
  Select,
  Textarea,
} from "../ui";
import {
  insertMention,
  mentionEditorValue,
  parseMentionContent,
  reconcileMentions,
  safeDisplayName,
  serializeMentionContent,
} from "../domain/collaboration";

const ROLE_LABELS = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const sentenceCase = (value) => {
  const text = String(value || "").trim();
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
};

/* -------------------------------------------------------------------------
 * Comment
 * ---------------------------------------------------------------------- */

const timeLabel = (comment) => {
  const parts = [
    comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Just now",
  ];
  if (comment.editedAt) parts.push("edited");
  return parts.join(" · ");
};

/** One comment, with the author's own edit and delete affordances. */
export function CommentRow({
  comment,
  currentUserId,
  profilesById,
  mentionCandidates = [],
  onUpdate,
  onDelete,
}) {
  const initialEditor = () => mentionEditorValue(comment.content, profilesById);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(() => initialEditor().value);
  const [mentions, setMentions] = useState(() => initialEditor().mentions);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const ownComment = comment.userId === currentUserId;
  const authorName = safeDisplayName(comment);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onUpdate?.(comment.id, serializeMentionContent(content, mentions));
      setEditing(false);
    } catch (updateError) {
      setError(updateError.message || "We couldn't update this comment.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onDelete?.(comment.id);
      setConfirmingDelete(false);
    } catch (deleteError) {
      setError(deleteError.message || "We couldn't delete this comment.");
      setConfirmingDelete(false);
      setBusy(false);
    }
  };

  const changeContent = (nextContent) => {
    setMentions((current) => reconcileMentions(content, nextContent, current));
    setContent(nextContent);
  };

  const addMention = (member) => {
    const next = insertMention(content, mentions, member);
    setContent(next.value);
    setMentions(next.mentions);
  };

  const cancelEditing = () => {
    const next = initialEditor();
    setContent(next.value);
    setMentions(next.mentions);
    setEditing(false);
    setError("");
  };

  return (
    <article className="comment" aria-busy={busy}>
      <Avatar name={authorName} src={comment.avatarUrl || ""} size="sm" />
      <div className="comment-body">
        <div className="comment-header">
          <span className="comment-author">{authorName}</span>
          <span className="comment-time">{timeLabel(comment)}</span>
          {ownComment && !editing ? (
            <Menu
              className="comment-menu"
              align="end"
              trigger={(triggerProps) => (
                <IconButton label="Comment actions" size="sm" {...triggerProps}>
                  <Icon name="more-horizontal" />
                </IconButton>
              )}
              items={[
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Icon name="edit" />,
                  onSelect: () => setEditing(true),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Icon name="trash" />,
                  danger: true,
                  disabled: busy,
                  onSelect: () => setConfirmingDelete(true),
                },
              ]}
            />
          ) : null}
        </div>

        {editing ? (
          <div className="comment-editor">
            <Textarea
              value={content}
              onChange={(event) => changeContent(event.target.value)}
              maxLength={4000}
              rows={3}
              disabled={busy}
              aria-label="Edit comment"
            />
            {mentionCandidates.length > 0 ? (
              <div
                className="menu comment-mentions"
                role="group"
                aria-label="Mention a project member"
              >
                {mentionCandidates.map((member) => (
                  <button
                    key={member.userId}
                    className="menu-item"
                    type="button"
                    onClick={() => addMention(member)}
                    disabled={busy}
                  >
                    @{safeDisplayName(member)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="comment-editor-actions">
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} loading={busy}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="comment-text">
            {parseMentionContent(comment.content, profilesById).map((part, index) =>
              part.type === "mention" ? (
                <mark className="comment-mention" key={`${part.userId}-${index}`}>
                  @{part.label}
                </mark>
              ) : (
                part.value
              )
            )}
          </p>
        )}

        {error ? (
          <p className="comment-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void remove()}
        title="Delete this comment?"
        description="The comment is removed for everyone on this project."
        confirmLabel="Delete"
        danger
        busy={busy}
      />
    </article>
  );
}

/* -------------------------------------------------------------------------
 * Activity
 * ---------------------------------------------------------------------- */

const ACTIVITY_LABELS = {
  task_created: "created a task",
  task_updated: "updated a task",
  task_completed: "completed a task",
  task_status_changed: "changed a task status",
  task_assigned: "assigned a task",
  task_unassigned: "unassigned a task",
  comment_added: "commented on a task",
  comment_updated: "edited a comment",
  comment_deleted: "deleted a comment",
};

const dotModifier = (type) => {
  if (type === "task_completed") return " is-done";
  if (String(type || "").startsWith("comment_")) return " is-comment";
  return "";
};

/** One activity event: who did what, and when. Never shows a raw user id. */
export function ActivityRow({ activity }) {
  const actorName = activity.userId ? safeDisplayName(activity) : "TaskFlow";
  const fallbackLabel = String(activity.type || "activity update").replaceAll("_", " ");

  return (
    <article className="activity-row">
      <span className={`activity-dot${dotModifier(activity.type)}`} aria-hidden="true" />
      <div className="activity-main">
        <p className="activity-text">
          <strong>{actorName}</strong> {ACTIVITY_LABELS[activity.type] || fallbackLabel}
          {activity.metadata?.taskTitle ? (
            <span className="activity-subject">{activity.metadata.taskTitle}</span>
          ) : null}
        </p>
        <time className="activity-time" dateTime={activity.createdAt || undefined}>
          {activity.createdAt
            ? new Date(activity.createdAt).toLocaleString()
            : "Just now"}
        </time>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------
 * Member
 * ---------------------------------------------------------------------- */

/** One project member; owners can change a role or remove the person. */
export function MemberRow({ member, ownerId, canManage, busy, onRoleChange, onRemove }) {
  const isOwner = member.userId === ownerId || member.role === "owner";
  const displayName = safeDisplayName(member);
  const roleLabel = isOwner
    ? ROLE_LABELS.owner
    : ROLE_LABELS[member.role] || member.role;
  const editable = canManage && !isOwner;

  return (
    <article className="member-row" aria-label={`${displayName}, ${member.role}`}>
      <Avatar name={displayName} src={member.avatarUrl || ""} size="md" />
      <div className="member-main">
        <span className="member-name truncate">{displayName}</span>
        {member.email ? (
          <span className="member-email truncate">{member.email}</span>
        ) : null}
      </div>
      {editable ? (
        <Select
          className="member-role"
          value={member.role}
          disabled={busy}
          aria-label={`Role for ${displayName}`}
          onChange={(event) => onRoleChange?.(member, event.target.value)}
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
          onClick={(event) => onRemove?.(member, event.currentTarget)}
        >
          <Icon name="trash" />
        </IconButton>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------
 * Invitation
 * ---------------------------------------------------------------------- */

const invitationExpired = (invitation) =>
  invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now();

/**
 * An invitation row. `incoming` shows the project I was invited to with Accept
 * and Decline; otherwise it shows the invited address with Cancel.
 */
export function InvitationRow({
  invitation,
  incoming = false,
  busy = false,
  onAccept,
  onDecline,
  onCancel,
}) {
  const expired = invitationExpired(invitation);
  const projectName = invitation.project?.name || "Project invitation";
  const inviterName = safeDisplayName({
    displayName: invitation.inviterDisplayName,
  });
  const roleLabel = ROLE_LABELS[invitation.role] || sentenceCase(invitation.role);
  const statusLabel =
    expired && invitation.status === "pending"
      ? "Expired"
      : sentenceCase(invitation.status);

  return (
    <article className="invitation-row">
      <div className="invitation-main">
        <span className="invitation-title truncate">
          {incoming ? projectName : invitation.email}
        </span>
        <span className="invitation-meta">
          {incoming
            ? `Invited by ${inviterName} · ${roleLabel}`
            : `${roleLabel} · ${statusLabel}`}
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
              onClick={() => onAccept?.(invitation)}
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onDecline?.(invitation)}
            >
              Decline
            </Button>
          </>
        ) : invitation.status === "pending" ? (
          <Button variant="ghost" size="sm" loading={busy} onClick={() => onCancel?.(invitation)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}
