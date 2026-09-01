import { useCallback, useEffect, useRef, useState } from "react";
import { attachmentKind, ATTACHMENT_ACCEPT, formatAttachmentSize } from "./domain/attachmentDomain";
import { attachmentService } from "./application/attachmentService";

const relativeDate = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

const initials = (name) => String(name || "TaskFlow user").trim().split(/\s+/).slice(0, 2)
  .map((part) => part[0]?.toUpperCase()).join("") || "T";

export default function AttachmentSection({
  projectId, entityType, entityId, userId, uploaderName = "TaskFlow user",
  canManage = false, compact = false, allowDrop = false, onCountChange,
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState("");
  const [errorHidden, setErrorHidden] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingName, setUploadingName] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const titleId = `attachments-${entityType}-${entityId}`;

  const updateItems = useCallback((items) => {
    setAttachments(items);
    onCountChange?.(entityId, items.length);
  }, [entityId, onCountChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorKind("");
    setErrorHidden(false);
    try { updateItems(await attachmentService.list({ projectId, entityType, entityId })); }
    catch {
      setError("Failed to load attachments.");
      setErrorKind("load");
    }
    finally { setLoading(false); }
  }, [entityId, entityType, projectId, updateItems]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file) => {
    if (!file || uploadingName || !canManage) return;
    setUploadingName(file.name);
    setError("");
    setErrorKind("");
    setErrorHidden(false);
    setMessage("");
    try {
      const created = await attachmentService.upload({
        projectId, entityType, entityId, file, userId, uploaderName,
      });
      updateItems([created, ...attachments]);
      setMessage("Attachment uploaded.");
    } catch (uploadError) { setError(uploadError.message); setErrorKind("action"); }
    finally {
      setUploadingName("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openAttachment = async (attachment) => {
    setOpeningId(attachment.id);
    setError("");
    setErrorKind("");
    setErrorHidden(false);
    try {
      const url = await attachmentService.open(attachment);
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (openError) { setError(openError.message); setErrorKind("action"); }
    finally { setOpeningId(""); }
  };

  const deleteAttachment = async (attachment) => {
    setDeletingId(attachment.id);
    setError("");
    setErrorKind("");
    setErrorHidden(false);
    try {
      await attachmentService.remove(attachment);
      updateItems(attachments.filter((item) => item.id !== attachment.id));
      setConfirmingDeleteId("");
      setMessage("Attachment deleted.");
    } catch (deleteError) { setError(deleteError.message); setErrorKind("action"); }
    finally { setDeletingId(""); }
  };

  return (
    <section
      className={`attachment-section${compact ? " is-compact" : ""}${dragActive ? " is-drag-active" : ""}`}
      aria-labelledby={titleId}
      onDragEnter={allowDrop && canManage ? (event) => { event.preventDefault(); setDragActive(true); } : undefined}
      onDragOver={allowDrop && canManage ? (event) => event.preventDefault() : undefined}
      onDragLeave={allowDrop && canManage ? (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); } : undefined}
      onDrop={allowDrop && canManage ? (event) => { event.preventDefault(); setDragActive(false); void upload(event.dataTransfer.files?.[0]); } : undefined}
    >
      <header className="attachment-section-header">
        <div><h3 id={titleId}>Attachments <span>{attachments.length}</span> <span className="inline-info-wrap"><button className="inline-info" type="button" aria-label="How attachments work">?</button><span className="inline-info-tooltip" role="tooltip">Private files, 10 MB max. Owners and editors manage; viewers can open.</span></span></h3><p>Files for this {entityType === "story" ? "Story" : entityType}.</p></div>
        {canManage && (
          <>
            <input ref={inputRef} className="sr-only" type="file" accept={ATTACHMENT_ACCEPT} onChange={(event) => void upload(event.target.files?.[0])} disabled={Boolean(uploadingName)} />
            <button className="ghost-btn compact-btn" type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(uploadingName)}>+ Add attachment</button>
          </>
        )}
      </header>
      {allowDrop && canManage && <p className="attachment-drop-hint">Drop a file here or choose Add attachment.</p>}
      {uploadingName && <div className="attachment-uploading" role="status"><span className="state-spinner" /><span><strong>Uploading…</strong><small>{uploadingName}</small></span></div>}
      {!loading && error && !errorHidden && (
        <div className="attachment-feedback is-error" role="alert" aria-live="assertive">
          <div>
            <strong>{error}</strong>
            {errorKind === "load" && <small>You can try again or close this message.</small>}
          </div>
          <div className="attachment-feedback-actions">
            {errorKind === "load" && <button className="primary-btn compact-btn" type="button" onClick={() => void load()}>Retry</button>}
            <button className="attachment-feedback-close" type="button" onClick={() => setErrorHidden(true)} aria-label="Close attachment error" title="Close">×</button>
          </div>
        </div>
      )}
      {message && <p className="attachment-feedback" role="status">{message}</p>}
      {loading ? <p className="attachment-state" role="status">Loading attachments…</p> : attachments.length === 0 ? (
        <div className="attachment-empty"><span aria-hidden="true">⌕</span><div><strong>No attachments</strong><p>Add a supporting file.</p></div></div>
      ) : (
        <div className="attachment-list">
          {attachments.map((attachment) => (
            <article className="attachment-row" key={attachment.id}>
              <span className={`attachment-file-icon is-${attachmentKind(attachment.contentType)}`} aria-hidden="true">{attachmentKind(attachment.contentType) === "image" ? "IMG" : attachmentKind(attachment.contentType).slice(0, 3).toUpperCase()}</span>
              <div className="attachment-copy"><strong title={attachment.fileName}>{attachment.fileName}</strong><small>{formatAttachmentSize(attachment.sizeBytes)} · <span className="attachment-uploader"><i aria-hidden="true">{initials(attachment.uploaderName)}</i>{attachment.uploaderName}</span> · {relativeDate(attachment.createdAt)}</small></div>
              <button className="ghost-btn compact-btn" type="button" onClick={() => void openAttachment(attachment)} disabled={openingId === attachment.id}>{openingId === attachment.id ? "Opening…" : "Open"}</button>
              {canManage && (confirmingDeleteId === attachment.id ? (
                <div className="attachment-delete-confirm"><button className="danger-btn compact-btn" type="button" onClick={() => void deleteAttachment(attachment)} disabled={deletingId === attachment.id}>{deletingId === attachment.id ? "Deleting…" : "Delete"}</button><button className="ghost-btn compact-btn" type="button" onClick={() => setConfirmingDeleteId("")} disabled={deletingId === attachment.id}>Cancel</button></div>
              ) : <button className="attachment-delete-button" type="button" aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" onClick={() => setConfirmingDeleteId(attachment.id)}>×</button>)}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
