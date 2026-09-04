import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ACCEPT,
  buildAttachmentStoragePath,
  formatAttachmentSize,
  safeAttachmentFileName,
  validateAttachmentEntity,
  validateAttachmentFile,
} from "./attachment";

const MAX_BYTES = 10 * 1024 * 1024;
const file = (name, type, size = 1024) => ({ name, type, size });

describe("upload validation", () => {
  it.each([
    ["brief.pdf", "application/pdf"],
    ["photo.JPG", "image/jpeg"],
    ["data.csv", "text/csv"],
  ])("accepts %s", (name, type) => {
    expect(validateAttachmentFile(file(name, type))).toBe("");
  });

  it.each([
    ["a disguised executable", file("malware.exe", "application/pdf"), /not supported/],
    ["a script", file("script.js", "text/javascript"), /not supported/],
    ["an archive", file("files.zip", "application/zip"), /not supported/],
    ["an empty file", file("empty.txt", "text/plain", 0), /empty/],
    [
      "an oversized file",
      file("large.pdf", "application/pdf", MAX_BYTES + 1),
      /10 MB/,
    ],
    ["no file at all", null, /Choose a file/],
  ])("rejects %s", (_label, candidate, pattern) => {
    expect(validateAttachmentFile(candidate)).toMatch(pattern);
  });

  it("accepts the exact 10 MB boundary", () => {
    expect(validateAttachmentFile(file("limit.pdf", "application/pdf", MAX_BYTES))).toBe(
      ""
    );
  });

  it("offers every supported extension to the file picker", () => {
    expect(ATTACHMENT_ACCEPT).toContain(".pdf");
    expect(ATTACHMENT_ACCEPT).toContain(".xlsx");
    expect(ATTACHMENT_ACCEPT).not.toContain(".exe");
  });
});

describe("storage paths", () => {
  it("strips traversal characters and accents from the stored name", () => {
    expect(safeAttachmentFileName("../Q3 budget (final).XLSX")).toBe(
      "Q3-budget-final.xlsx"
    );
    expect(safeAttachmentFileName("")).toBe("file");
  });

  it.each([
    ["project", "project-a"],
    ["story", "story-a"],
    ["task", "task-a"],
  ])("builds a scoped %s path", (entityType, entityId) => {
    expect(
      buildAttachmentStoragePath({
        projectId: "project-a",
        entityType,
        entityId,
        attachmentId: "attachment-a",
        fileName: "../road map.pdf",
      })
    ).toBe(`projects/project-a/${entityType}/${entityId}/attachment-a-road-map.pdf`);
  });

  it("requires an attachment id", () => {
    expect(() =>
      buildAttachmentStoragePath({
        projectId: "project-a",
        entityType: "task",
        entityId: "task-a",
        fileName: "notes.txt",
      })
    ).toThrow(/attachment ID/i);
  });

  it("enforces project attachment identity and supported entity types", () => {
    expect(() =>
      validateAttachmentEntity({
        projectId: "a",
        entityType: "project",
        entityId: "b",
      })
    ).toThrow(/must belong/);
    expect(() =>
      validateAttachmentEntity({
        projectId: "a",
        entityType: "comment",
        entityId: "b",
      })
    ).toThrow(/valid attachment/);
  });
});

describe("size formatting", () => {
  it.each([
    [512, "512 B"],
    [2048, "2 KB"],
    [1572864, "1.5 MB"],
  ])("formats %s bytes as %s", (bytes, expected) => {
    expect(formatAttachmentSize(bytes)).toBe(expected);
  });
});
