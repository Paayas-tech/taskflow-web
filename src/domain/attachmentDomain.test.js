import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  buildAttachmentStoragePath,
  formatAttachmentSize,
  safeAttachmentFileName,
  validateAttachmentEntity,
  validateAttachmentFile,
} from "./attachmentDomain";

const file = (name, type, size = 1024) => ({ name, type, size });

describe("attachment domain", () => {
  it("accepts supported documents and images", () => {
    expect(validateAttachmentFile(file("brief.pdf", "application/pdf"))).toBe("");
    expect(validateAttachmentFile(file("photo.JPG", "image/jpeg"))).toBe("");
    expect(validateAttachmentFile(file("data.csv", "text/csv"))).toBe("");
  });

  it("rejects disguised, executable, archive, empty, and oversized files", () => {
    expect(validateAttachmentFile(file("malware.exe", "application/pdf"))).toMatch(/not supported/);
    expect(validateAttachmentFile(file("script.js", "text/javascript"))).toMatch(/not supported/);
    expect(validateAttachmentFile(file("files.zip", "application/zip"))).toMatch(/not supported/);
    expect(validateAttachmentFile(file("empty.txt", "text/plain", 0))).toMatch(/empty/);
    expect(validateAttachmentFile(file("large.pdf", "application/pdf", ATTACHMENT_MAX_BYTES + 1))).toMatch(/10 MB/);
  });

  it("accepts the exact 10 MB boundary and rejects one byte above it", () => {
    expect(validateAttachmentFile(file("limit.pdf", "application/pdf", ATTACHMENT_MAX_BYTES))).toBe("");
    expect(validateAttachmentFile(file("too-large.pdf", "application/pdf", ATTACHMENT_MAX_BYTES + 1))).toMatch(/10 MB/);
  });

  it("creates safe project-scoped paths without retaining traversal characters", () => {
    expect(safeAttachmentFileName("../Q3 budget (final).XLSX")).toBe("Q3-budget-final.xlsx");
    expect(buildAttachmentStoragePath({
      projectId: "project-a", entityType: "task", entityId: "task-a",
      attachmentId: "attachment-a", fileName: "../road map.pdf",
    })).toBe("projects/project-a/task/task-a/attachment-a-road-map.pdf");
  });

  it("enforces project attachment identity and supported entity types", () => {
    expect(() => validateAttachmentEntity({ projectId: "a", entityType: "project", entityId: "b" })).toThrow(/must belong/);
    expect(() => validateAttachmentEntity({ projectId: "a", entityType: "comment", entityId: "b" })).toThrow(/valid attachment/);
  });

  it.each([
    ["project", "project-a"],
    ["story", "story-a"],
    ["task", "task-a"],
  ])("builds a scoped %s attachment path", (entityType, entityId) => {
    expect(buildAttachmentStoragePath({
      projectId: "project-a", entityType, entityId,
      attachmentId: "attachment-a", fileName: "notes.txt",
    })).toBe(`projects/project-a/${entityType}/${entityId}/attachment-a-notes.txt`);
  });

  it("formats compact file sizes", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2 KB");
    expect(formatAttachmentSize(1572864)).toBe("1.5 MB");
  });
});
