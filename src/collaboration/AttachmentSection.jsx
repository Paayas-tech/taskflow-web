import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  Menu,
} from "../ui";
import { ATTACHMENT_ACCEPT, formatAttachmentSize } from "../domain/attachmentDomain";
import { attachmentService } from "../application/attachmentService";

const relativeDate = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

export default function AttachmentSection({
  projectId, entityType, entityId, userId, uploaderName = "TaskFlow user",
  canManage = false, compact = false, allowDrop = false, onCountChange, onMutation,
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
      setMessage("Uploaded · saved automatically.");
      onMutation?.("upload", created);
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
      setMessage("Deleted · saved automatically.");
      onMutation?.("delete", attachment);
    } catch (deleteError) { setError(deleteError.message); setErrorKind("action"); }
    finally { setDeletingId(""); }
  };

  const dropHandlers = allowDrop && canManage ? {
    onDragEnter: (event) => { event.preventDefault(); setDragActive(true); },
    onDragOver: (event) => event.preventDefault(),
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragActive(false);
      void upload(event.dataTransfer.files?.[0]);
    },
  } : {};
  const pendingDelete = attachments.find((item) => item.id === confirmingDeleteId) ?? null;

  return (
    <section
      className={`attachment-section${compact ? " is-compact" : ""}${dragActive ? " is-drag-active" : ""}`}
      aria-label="Attachments"
      {...dropHandlers}
    >
      <div className="attachment-toolbar">
        {compact ? null : (
          <h3 className="section-title">
            Attachments
            <span className="section-meta">{attachments.length}</span>
          </h3>
        )}
        <span className="toolbar-spacer" />
        {canManage ? (
          <>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept={ATTACHMENT_ACCEPT}
              aria-label="Choose a file to upload"
              onChange={(event) => void upload(event.target.files?.[0])}
              disabled={Boolean(uploadingName)}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="paperclip" />}
              onClick={() => inputRef.current?.click()}
              disabled={Boolean(uploadingName)}
            >
              Upload
            </Button>
          </>
        ) : null}
      </div>

      {allowDrop && canManage ? (
        <p className="attachment-dropzone">Drop a file here, or choose Upload. 10 MB max.</p>
      ) : null}
      {uploadingName ? (
        <InlineNotice tone="info">{`Uploading ${uploadingName}…`}</InlineNotice>
      ) : null}
      {!loading && error && !errorHidden ? (
        <InlineNotice
          tone="error"
          onDismiss={() => setErrorHidden(true)}
          action={errorKind === "load" ? (
            <Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button>
          ) : null}
        >
          {error}
        </InlineNotice>
      ) : null}
      {message ? <InlineNotice tone="success">{message}</InlineNotice> : null}

      {loading ? (
        <p className="attachment-state" role="status">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <EmptyState
          icon="paperclip"
          title="No attachments"
          description={canManage ? "Upload a file to share it with the project." : undefined}
        />
      ) : (
        <div className="row-list attachment-list">
          {attachments.map((attachment) => (
            <article className="attachment-row" key={attachment.id}>
              <span className="attachment-icon" aria-hidden="true">
                <Icon name="paperclip" />
              </span>
              <div className="attachment-main">
                <span className="attachment-name truncate" title={attachment.fileName}>
                  {attachment.fileName}
                </span>
                <span className="attachment-meta">
                  {`${formatAttachmentSize(attachment.sizeBytes)} · ${attachment.uploaderName || "TaskFlow user"} · ${relativeDate(attachment.createdAt)}`}
                </span>
              </div>
              <Menu
                align="end"
                trigger={(triggerProps) => (
                  <IconButton label={`Actions for ${attachment.fileName}`} size="sm" {...triggerProps}>
                    <Icon name="more-horizontal" />
                  </IconButton>
                )}
                items={[
                  {
                    id: "download",
                    label: "Download",
                    icon: <Icon name="external-link" />,
                    disabled: openingId === attachment.id,
                    onSelect: () => void openAttachment(attachment),
                  },
                  ...(canManage ? [{
                    id: "delete",
                    label: "Delete",
                    icon: <Icon name="trash" />,
                    danger: true,
                    onSelect: () => setConfirmingDeleteId(attachment.id),
                  }] : []),
                ]}
              />
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setConfirmingDeleteId("")}
        onConfirm={() => void deleteAttachment(pendingDelete)}
        title="Delete attachment?"
        description={pendingDelete ? `${pendingDelete.fileName} is removed for everyone on this project.` : ""}
        confirmLabel="Delete"
        danger
        busy={Boolean(deletingId)}
      />
    </section>
  );
}
