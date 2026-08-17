import { useState } from "react";

const mentionParts = (content) =>
  String(content || "").split(/(@[0-9a-fA-F-]{36})/g);

export default function CommentRow({ comment, currentUserId, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ownComment = comment.userId === currentUserId;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onUpdate(comment.id, content);
      setEditing(false);
    } catch (updateError) {
      setError(updateError.message || "We couldn't update this comment.");
    } finally {
      setBusy(false);
    }
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
    <article className="settings-card" aria-busy={busy}>
      <div className="section-heading-row">
        <div>
          <strong>{comment.userId}</strong>
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
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} />
          <div className="project-card-actions">
            <button className="ghost-btn compact-btn" type="button" onClick={() => { setContent(comment.content); setEditing(false); setError(""); }} disabled={busy}>Cancel</button>
            <button className="primary-btn compact-btn" type="button" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
          </div>
        </div>
      ) : (
        <p>
          {mentionParts(comment.content).map((part, index) =>
            part.startsWith("@") ? <mark key={`${part}-${index}`}>{part}</mark> : part
          )}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}
