import { useState } from "react";
import { safeDisplayName } from "./domain/identityDomain";
import { insertMention, mentionEditorValue, parseMentionContent, reconcileMentions, serializeMentionContent } from "./domain/mentionDomain";

export default function CommentRow({ comment, currentUserId, profilesById, mentionCandidates = [], onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const initialEditor = () => mentionEditorValue(comment.content, profilesById);
  const [content, setContent] = useState(() => initialEditor().value);
  const [mentions, setMentions] = useState(() => initialEditor().mentions);
  const [busy, setBusy] = useState(false);
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
    if (busy || !window.confirm("Delete this comment?")) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(comment.id);
    } catch (deleteError) {
      setError(deleteError.message || "We couldn't delete this comment.");
      setBusy(false);
    }
  };

  return (
    <article className="task-comment-row" aria-busy={busy}>
      <span className="task-collaboration-avatar" aria-hidden="true">{authorName.slice(0, 1).toUpperCase()}</span>
      <div className="section-heading-row">
        <div>
          <strong>{authorName}</strong>
          <p className="form-hint">
            {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Just now"}
            {comment.editedAt ? " · edited" : ""}
          </p>
        </div>
        {ownComment && !editing && (
          <div className="project-card-actions">
            <button className="ghost-btn compact-btn" type="button" onClick={() => setEditing(true)}>Edit</button>
            <button className="danger-btn compact-btn" type="button" onClick={remove} disabled={busy}>Delete</button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="form-group">
          <textarea value={content} onChange={(event) => changeContent(event.target.value)} maxLength={4000} />
          {mentionCandidates.length > 0 && <div className="project-card-actions" aria-label="Mention a project member">{mentionCandidates.map((member) => <button key={member.userId} className="ghost-btn compact-btn" type="button" onClick={() => addMention(member)} disabled={busy}>@{safeDisplayName(member)}</button>)}</div>}
          <div className="project-card-actions">
            <button className="ghost-btn compact-btn" type="button" onClick={() => { resetEditor(); setEditing(false); setError(""); }} disabled={busy}>Cancel</button>
            <button className="primary-btn compact-btn" type="button" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
          </div>
        </div>
      ) : (
        <p>
          {parseMentionContent(comment.content, profilesById).map((part, index) =>
            part.type === "mention" ? <mark key={`${part.userId}-${index}`}>@{part.label}</mark> : part.value
          )}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}
