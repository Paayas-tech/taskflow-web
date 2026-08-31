export const ATTACHMENT_BUCKET = "taskflow-attachments";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ENTITY_TYPES = Object.freeze(["project", "story", "task"]);

const allowedTypes = new Map([
  ["application/pdf", ["pdf"]],
  ["text/plain", ["txt"]],
  ["text/csv", ["csv"]],
  ["application/msword", ["doc"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["application/vnd.ms-excel", ["xls"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx"]],
  ["application/vnd.ms-powerpoint", ["ppt"]],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ["pptx"]],
  ["image/png", ["png"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/webp", ["webp"]],
]);

export const ATTACHMENT_ALLOWED_MIME_TYPES = Object.freeze([...allowedTypes.keys()]);
export const ATTACHMENT_ACCEPT = Object.freeze(
  [...new Set([...allowedTypes.values()].flat())].map((extension) => `.${extension}`).join(",")
);

const extensionOf = (name) => {
  const match = /\.([^.]+)$/.exec(String(name || "").trim().toLowerCase());
  return match?.[1] || "";
};

export const validateAttachmentFile = (file) => {
  if (!file || typeof file.name !== "string") return "Choose a file to upload.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "The selected file is empty.";
  if (file.size > ATTACHMENT_MAX_BYTES) return "Files must be 10 MB or smaller.";
  const extension = extensionOf(file.name);
  const type = String(file.type || "").toLowerCase();
  const matchingExtensions = allowedTypes.get(type);
  if (!matchingExtensions || !matchingExtensions.includes(extension)) {
    return "This file type is not supported.";
  }
  return "";
};

export const safeAttachmentFileName = (value) => {
  const raw = String(value || "file").split(/[\\/]/).pop() || "file";
  const dot = raw.lastIndexOf(".");
  const extension = dot > 0 ? raw.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = (dot > 0 ? raw.slice(0, dot) : raw)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, Math.max(1, 100 - extension.length)) || "file";
  return `${base}${extension}`;
};

export const validateAttachmentEntity = ({ projectId, entityType, entityId }) => {
  if (!projectId || !entityId || !ATTACHMENT_ENTITY_TYPES.includes(entityType)) {
    throw new Error("Choose a valid attachment destination.");
  }
  if (entityType === "project" && entityId !== projectId) {
    throw new Error("Project attachments must belong to that project.");
  }
};

export const buildAttachmentStoragePath = ({ projectId, entityType, entityId, attachmentId, fileName }) => {
  validateAttachmentEntity({ projectId, entityType, entityId });
  if (!attachmentId) throw new Error("An attachment ID is required.");
  return `projects/${projectId}/${entityType}/${entityId}/${attachmentId}-${safeAttachmentFileName(fileName)}`;
};

export const formatAttachmentSize = (bytes) => {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const attachmentKind = (contentType = "") => {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.includes("word")) return "document";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "spreadsheet";
  if (contentType.includes("presentation") || contentType.includes("powerpoint")) return "presentation";
  return "file";
};
