/**
 * Files attached to one task, story or project. The list is storage-backed and
 * read through the api the store was configured with; the count is mirrored
 * into the store so every task surface shows the paperclip badge for free.
 */
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
import { ATTACHMENT_ACCEPT, formatAttachmentSize } from "../domain/attachment";
import { safeDisplayName } from "../domain/collaboration";
import { setAttachmentCount } from "../store/projects";
import { selectUser } from "../store/selectors";
import { api, useStore } from "../store/store";

const relativeDate = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

export function AttachmentSection({
  projectId,
  entityType,
  entityId,
  canManage = false,
  compact = false,
  allowDrop = false,
  onMutation,
}) {
  const user = useStore(selectUser);
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

  const updateItems = useCallback(
    (items) => {
      setAttachments(items);
      setAttachmentCount(entityId, items.length);
    },
    [entityId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorKind("");
    setErrorHidden(false);
    try {
      updateItems(await api().listAttachments({ projectId, entityType, entityId }));
    } catch {
      setError("Failed to load attachments.");
      setErrorKind("load");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, projectId, updateItems]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearNotices = () => {
    setError("");
    setErrorKind("");
    setErrorHidden(false);
  };

  const upload = async (file) => {
    if (!file || uploadingName || !canManage) return;
    setUploadingName(file.name);
    clearNotices();
    setMessage("");
    try {
      const created = await api().uploadAttachment({
        projectId,
        entityType,
        entityId,
        file,
        userId: user?.id || "",
        uploaderName: safeDisplayName(user),
      });
      updateItems([created, ...attachments]);
      setMessage("Uploaded · saved automatically.");
      onMutation?.("upload", created);
    } catch (uploadError) {
      setError(uploadError.message);
      setErrorKind("action");
    } finally {
      setUploadingName("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openAttachment = async (attachment) => {
    setOpeningId(attachment.id);
    clearNotices();
    try {
      const url = await api().openAttachment(attachment);
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (openError) {
      setError(openError.message);
      setErrorKind("action");
    } finally {
      setOpeningId("");
    }
  };

  const deleteAttachment = async (attachment) => {
    setDeletingId(attachment.id);
    clearNotices();
    try {
      await api().removeAttachment(attachment);
      updateItems(attachments.filter((item) => item.id !== attachment.id));
      setConfirmingDeleteId("");
      setMessage("Deleted · saved automatically.");
      onMutation?.("delete", attachment);
    } catch (deleteError) {
      setError(deleteError.message);
      setErrorKind("action");
    } finally {
      setDeletingId("");
    }
  };

  const dropHandlers =
    allowDrop && canManage
      ? {
          onDragEnter: (event) => {
            event.preventDefault();
            setDragActive(true);
          },
          onDragOver: (event) => event.preventDefault(),
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
          },
          onDrop: (event) => {
            event.preventDefault();
            setDragActive(false);
            void upload(event.dataTransfer.files?.[0]);
          },
        }
      : {};

  const pendingDelete =
    attachments.find((item) => item.id === confirmingDeleteId) ?? null;

  return (
    <section
      className={`attachment-section${compact ? " is-compact" : ""}${dragActive ? " is-drag-active" : ""}`}
      aria-label="Attachments"
      {...dropHandlers}
    >
      <div className="attachment-toolbar">
        <h3 className="section-title">Attachments</h3>
        {attachments.length > 0 ? (
          <span className="section-meta">{attachments.length}</span>
        ) : null}
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

      {allowDrop && canManage && (!compact || (!loading && attachments.length === 0)) ? (
        <p className="attachment-dropzone">
          {compact ? <Icon name="paperclip" size={14} /> : null}
          <span>
            {compact
              ? "Drop a file here · 10 MB max"
              : "Drop a file here, or choose Upload. 10 MB max."}
          </span>
        </p>
      ) : null}

      {uploadingName ? (
        <InlineNotice tone="info">{`Uploading ${uploadingName}…`}</InlineNotice>
      ) : null}

      {!loading && error && !errorHidden ? (
        <InlineNotice
          tone="error"
          onDismiss={() => setErrorHidden(true)}
          action={
            errorKind === "load" ? (
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            ) : null
          }
        >
          {error}
        </InlineNotice>
      ) : null}

      {message ? <InlineNotice tone="success">{message}</InlineNotice> : null}

      {loading ? (
        <p className="attachment-state" role="status">
          Loading attachments…
        </p>
      ) : attachments.length === 0 && compact ? (
        allowDrop && canManage ? null : <p className="attachment-state">No attachments</p>
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
                  <IconButton
                    label={`Actions for ${attachment.fileName}`}
                    size="sm"
                    {...triggerProps}
                  >
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
                  ...(canManage
                    ? [
                        {
                          id: "delete",
                          label: "Delete",
                          icon: <Icon name="trash" />,
                          danger: true,
                          onSelect: () => setConfirmingDeleteId(attachment.id),
                        },
                      ]
                    : []),
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
        description={
          pendingDelete
            ? `${pendingDelete.fileName} is removed for everyone on this project.`
            : ""
        }
        confirmLabel="Delete"
        danger
        busy={Boolean(deletingId)}
      />
    </section>
  );
}
