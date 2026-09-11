import {
  ATTACHMENT_BUCKET,
  buildAttachmentStoragePath,
  safeAttachmentFileName,
  validateAttachmentEntity,
  validateAttachmentFile,
} from "../domain/attachment";
import { requireSupabase, throwIfError } from "./client";
import { profilesById } from "./projects";

const ATTACHMENT_SELECT = `id, project_id, entity_type, entity_id, storage_path,
  file_name, content_type, size_bytes, uploaded_by, created_at`;

const attachmentRows = () => requireSupabase().from("attachments");
const bucket = () => requireSupabase().storage.from(ATTACHMENT_BUCKET);

const friendlyAttachmentError = (error, fallback) => {
  const message = String(error?.message || "").toLowerCase();
  if (
    message.includes("row-level security") ||
    message.includes("permission") ||
    message.includes("policy")
  ) {
    return new Error(
      "You don’t have permission to manage attachments in this project."
    );
  }
  return new Error(fallback);
};

/** Runs `work`, reporting a refusal as something the reader can act on. */
const friendly = async (fallback, work) => {
  try {
    return await work();
  } catch (error) {
    throw friendlyAttachmentError(error, fallback);
  }
};

const rowToAttachment = (row = {}, profile) => ({
  id: row.id,
  projectId: row.project_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  storagePath: row.storage_path,
  fileName: row.file_name,
  contentType: row.content_type || "application/octet-stream",
  sizeBytes: Number(row.size_bytes) || 0,
  uploadedBy: row.uploaded_by,
  uploaderName: profile?.displayName || "TaskFlow user",
  uploaderAvatarUrl: profile?.avatarUrl || "",
  createdAt: row.created_at,
});

/** Everything attached to one entity, newest first. */
const entityQuery = (context) =>
  attachmentRows()
    .select(ATTACHMENT_SELECT)
    .eq("project_id", context.projectId)
    .eq("entity_type", context.entityType)
    .eq("entity_id", context.entityId);

const readAttachments = async (query) => {
  const { data, error } = await query.order("created_at", { ascending: false });
  throwIfError(error);
  const rows = data || [];
  if (!rows.length) return [];
  const byId = await profilesById(rows.map((row) => row.uploaded_by));
  return rows.map((row) => rowToAttachment(row, byId.get(row.uploaded_by)));
};

export const listAttachments = async (context = {}) => {
  validateAttachmentEntity(context);
  return friendly("Attachments could not be loaded. Please try again.", () =>
    readAttachments(entityQuery(context))
  );
};

/** { [taskId]: count } for one project. Never throws: a count is not critical. */
export const listTaskAttachmentCounts = async (projectId) => {
  if (!projectId) return {};
  try {
    const { data, error } = await attachmentRows()
      .select("entity_id")
      .eq("project_id", projectId)
      .eq("entity_type", "task");
    throwIfError(error);
    return (data || []).reduce((counts, row) => {
      counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
      return counts;
    }, {});
  } catch {
    return {};
  }
};

export const uploadAttachment = async (values) => {
  const { file, userId, uploaderName, ...context } = values;
  validateAttachmentEntity(context);
  const validationError = validateAttachmentFile(file);
  if (validationError) throw new Error(validationError);
  if (!userId) throw new Error("Sign in to add attachments.");

  const id = crypto.randomUUID();
  const fileName = safeAttachmentFileName(file.name);
  const storagePath = buildAttachmentStoragePath({
    ...context,
    attachmentId: id,
    fileName,
  });

  const upload = await bucket().upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) {
    throw friendlyAttachmentError(upload.error, "Upload failed. Please try again.");
  }

  const { data, error } = await attachmentRows()
    .insert({
      id,
      project_id: context.projectId,
      entity_type: context.entityType,
      entity_id: context.entityId,
      storage_path: storagePath,
      file_name: file.name.slice(0, 255),
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select(ATTACHMENT_SELECT)
    .single();
  if (error) {
    // Never leave an orphaned object behind when the metadata row is refused.
    await bucket().remove([storagePath]).catch(() => {});
    throw friendlyAttachmentError(error, "Upload failed. Please try again.");
  }
  return rowToAttachment(data, { displayName: uploaderName });
};

export const openAttachment = (attachment) =>
  friendly("This attachment could not be opened. Please try again.", async () => {
    const { data, error } = await bucket().createSignedUrl(
      attachment.storagePath,
      60
    );
    throwIfError(error);
    if (!data?.signedUrl) throw new Error("Attachment unavailable.");
    return data.signedUrl;
  });

const removeOne = async (attachment) => {
  const removal = await bucket().remove([attachment.storagePath]);
  throwIfError(removal.error);
  const { data, error } = await attachmentRows()
    .delete()
    .eq("id", attachment.id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Attachment unavailable.");
};

export const removeAttachment = (attachment) =>
  friendly("This attachment could not be deleted. Please try again.", () =>
    removeOne(attachment)
  );

/**
 * Storage objects are not touched by the task-delete trigger, so everything a
 * deleted task or project owns has to be cleared here first.
 */
export const removeAllAttachments = async (context = {}) => {
  const wholeProject =
    context.entityType === "project" && context.entityId === context.projectId;

  let attachments;
  if (wholeProject) {
    const { data, error } = await attachmentRows()
      .select(ATTACHMENT_SELECT)
      .eq("project_id", context.projectId);
    throwIfError(error);
    attachments = (data || []).map((row) => rowToAttachment(row));
  } else {
    attachments = await readAttachments(entityQuery(context));
  }

  await friendly(
    "Attachments could not be cleaned up. The item was not deleted.",
    async () => {
      for (const attachment of attachments) await removeOne(attachment);
    }
  );
};
