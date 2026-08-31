import { requireSupabase } from "./client.js";
import { ATTACHMENT_BUCKET } from "../../domain/attachmentDomain.js";

const throwIfError = (error) => { if (error) throw error; };

const mapRow = (row, profile) => ({
  id: row.id,
  projectId: row.project_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  storagePath: row.storage_path,
  fileName: row.file_name,
  contentType: row.content_type || "application/octet-stream",
  sizeBytes: Number(row.size_bytes) || 0,
  uploadedBy: row.uploaded_by,
  uploaderName: profile?.display_name || "TaskFlow user",
  uploaderAvatarUrl: profile?.avatar_url || "",
  createdAt: row.created_at,
});

export const createAttachmentRepository = (client = null) => {
  const database = () => client || requireSupabase();
  return {
    async list(projectId, entityType, entityId) {
      const { data, error } = await database().from("attachments")
        .select("id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by, created_at")
        .eq("project_id", projectId).eq("entity_type", entityType).eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      throwIfError(error);
      const rows = data || [];
      if (!rows.length) return [];
      const uploaderIds = [...new Set(rows.map((row) => row.uploaded_by))];
      const { data: profiles, error: profileError } = await database().rpc("get_visible_user_profiles", { target_user_ids: uploaderIds });
      throwIfError(profileError);
      const byId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      return rows.map((row) => mapRow(row, byId.get(row.uploaded_by)));
    },

    async listTaskCounts(projectId) {
      const { data, error } = await database().from("attachments")
        .select("entity_id").eq("project_id", projectId).eq("entity_type", "task");
      throwIfError(error);
      return (data || []).reduce((counts, row) => {
        counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
        return counts;
      }, {});
    },

    async listProject(projectId) {
      const { data, error } = await database().from("attachments")
        .select("id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by, created_at")
        .eq("project_id", projectId);
      throwIfError(error);
      return (data || []).map((row) => mapRow(row));
    },

    async uploadObject(path, file) {
      const { error } = await database().storage.from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      throwIfError(error);
    },

    async createMetadata(values) {
      const { data, error } = await database().from("attachments").insert({
        id: values.id, project_id: values.projectId, entity_type: values.entityType,
        entity_id: values.entityId, storage_path: values.storagePath,
        file_name: values.fileName, content_type: values.contentType,
        size_bytes: values.sizeBytes, uploaded_by: values.uploadedBy,
      }).select("id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by, created_at").single();
      throwIfError(error);
      return mapRow(data, { display_name: values.uploaderName });
    },

    async removeObject(path) {
      const { error } = await database().storage.from(ATTACHMENT_BUCKET).remove([path]);
      throwIfError(error);
    },

    async deleteMetadata(id) {
      const { data, error } = await database().from("attachments").delete().eq("id", id).select("id").maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("Attachment unavailable.");
    },

    async createSignedUrl(path) {
      const { data, error } = await database().storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60);
      throwIfError(error);
      if (!data?.signedUrl) throw new Error("Attachment unavailable.");
      return data.signedUrl;
    },
  };
};

export const attachmentRepository = createAttachmentRepository();
