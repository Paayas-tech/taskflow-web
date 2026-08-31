import {
  buildAttachmentStoragePath,
  safeAttachmentFileName,
  validateAttachmentEntity,
  validateAttachmentFile,
} from "../domain/attachmentDomain.js";
import { attachmentRepository } from "../infrastructure/supabase/attachmentRepository.js";

const friendlyAttachmentError = (error, fallback) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("row-level security") || message.includes("permission") || message.includes("policy")) {
    return new Error("You don’t have permission to manage attachments in this project.");
  }
  return new Error(fallback);
};

export const createAttachmentService = (
  repository,
  { createId = () => crypto.randomUUID() } = {}
) => ({
  async list(context) {
    validateAttachmentEntity(context);
    try {
      return await repository.list(context.projectId, context.entityType, context.entityId);
    } catch (error) {
      throw friendlyAttachmentError(error, "Attachments could not be loaded. Please try again.");
    }
  },

  async getTaskCounts(projectId) {
    if (!projectId) return {};
    try { return await repository.listTaskCounts(projectId); }
    catch { return {}; }
  },

  async upload({ file, userId, uploaderName, ...context }) {
    validateAttachmentEntity(context);
    const validationError = validateAttachmentFile(file);
    if (validationError) throw new Error(validationError);
    if (!userId) throw new Error("Sign in to add attachments.");
    const id = createId();
    const fileName = safeAttachmentFileName(file.name);
    const storagePath = buildAttachmentStoragePath({ ...context, attachmentId: id, fileName });
    try {
      await repository.uploadObject(storagePath, file);
    } catch (error) {
      throw friendlyAttachmentError(error, "Upload failed. Please try again.");
    }
    try {
      return await repository.createMetadata({
        id, ...context, storagePath, fileName: file.name.slice(0, 255),
        contentType: file.type, sizeBytes: file.size, uploadedBy: userId, uploaderName,
      });
    } catch (error) {
      await repository.removeObject(storagePath).catch(() => {});
      throw friendlyAttachmentError(error, "Upload failed. Please try again.");
    }
  },

  async open(attachment) {
    try { return await repository.createSignedUrl(attachment.storagePath); }
    catch (error) { throw friendlyAttachmentError(error, "This attachment could not be opened. Please try again."); }
  },

  async remove(attachment) {
    try {
      await repository.removeObject(attachment.storagePath);
      await repository.deleteMetadata(attachment.id);
    } catch (error) {
      throw friendlyAttachmentError(error, "This attachment could not be deleted. Please try again.");
    }
  },

  async removeAll(context) {
    const attachments = context.entityType === "project" && context.entityId === context.projectId
      ? await repository.listProject(context.projectId)
      : await repository.list(context.projectId, context.entityType, context.entityId);
    for (const attachment of attachments) {
      try {
        await repository.removeObject(attachment.storagePath);
        await repository.deleteMetadata(attachment.id);
      } catch (error) {
        throw friendlyAttachmentError(error, "Attachments could not be cleaned up. The item was not deleted.");
      }
    }
  },
});

export const attachmentService = createAttachmentService(attachmentRepository);
