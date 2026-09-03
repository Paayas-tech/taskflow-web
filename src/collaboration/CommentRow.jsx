import { useState } from "react";
import { Avatar, Button, ConfirmDialog, Icon, IconButton, Menu, Textarea } from "../ui";
import { safeDisplayName } from "../domain/identityDomain";
import {
  insertMention,
  mentionEditorValue,
  parseMentionContent,
  reconcileMentions,
  serializeMentionContent,
} from "../domain/mentionDomain";

const timeLabel = (comment) => {
  const parts = [comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Just now"];
  if (comment.editedAt) {
    parts.push("edited");
  }
  return parts.join(" · ");
};

export default function CommentRow({
  comment,
  currentUserId,
  profilesById,
  mentionCandidates = [],
  onUpdate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const initialEditor = () => mentionEditorValue(comment.content, profilesById);
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
      await onUpdate(comment.id, serializeMentionContent(content, mentions));
      setEditing(false);
    } catch (updateError) {
      setError(updateError.message || "We couldn't update this comment.");
    } finally {
      setBusy(false);
    }
  };
  const resetEditor = () => {
    const next = initialEditor();
    setContent(next.value);
    setMentions(next.mentions);
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

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(comment.id);
      setConfirmingDelete(false);
    } catch (deleteError) {
      setError(deleteError.message || "We couldn't delete this comment.");
      setConfirmingDelete(false);
      setBusy(false);
    }
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
              <div className="menu comment-mentions" role="group" aria-label="Mention a project member">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetEditor();
                  setEditing(false);
                  setError("");
                }}
                disabled={busy}
              >
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
                <mark className="comment-mention" key={`${part.userId}-${index}`}>@{part.label}</mark>
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
