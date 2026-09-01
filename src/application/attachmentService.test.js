import { describe, expect, it, vi } from "vitest";
import { createAttachmentService } from "./attachmentService";

const context = { projectId: "project-a", entityType: "task", entityId: "task-a" };
const validFile = { name: "brief.pdf", type: "application/pdf", size: 2048 };

const repository = () => ({
  list: vi.fn().mockResolvedValue([]),
  listProject: vi.fn().mockResolvedValue([]),
  listTaskCounts: vi.fn().mockResolvedValue({}),
  uploadObject: vi.fn().mockResolvedValue(undefined),
  createMetadata: vi.fn().mockImplementation(async (values) => values),
  removeObject: vi.fn().mockResolvedValue(undefined),
  deleteMetadata: vi.fn().mockResolvedValue(undefined),
  createSignedUrl: vi.fn().mockResolvedValue("https://signed.example/file"),
});

describe("attachment service", () => {
  it("uploads storage before metadata and returns the created attachment", async () => {
    const repo = repository();
    const service = createAttachmentService(repo, { createId: () => "attachment-a" });
    const result = await service.upload({ ...context, file: validFile, userId: "user-a", uploaderName: "Asha" });
    expect(repo.uploadObject).toHaveBeenCalledWith(
      "projects/project-a/task/task-a/attachment-a-brief.pdf",
      validFile
    );
    expect(repo.createMetadata).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: "user-a", uploaderName: "Asha" }));
    expect(result.id).toBe("attachment-a");
  });

  it("does not create metadata when storage upload fails", async () => {
    const repo = repository();
    repo.uploadObject.mockRejectedValue(new Error("network"));
    const service = createAttachmentService(repo, { createId: () => "attachment-a" });
    await expect(service.upload({ ...context, file: validFile, userId: "user-a" })).rejects.toThrow("Upload failed");
    expect(repo.createMetadata).not.toHaveBeenCalled();
  });

  it("attempts orphan cleanup when metadata creation fails", async () => {
    const repo = repository();
    repo.createMetadata.mockRejectedValue(new Error("policy"));
    const service = createAttachmentService(repo, { createId: () => "attachment-a" });
    await expect(service.upload({ ...context, file: validFile, userId: "user-a" })).rejects.toThrow(/permission/);
    expect(repo.removeObject).toHaveBeenCalledWith("projects/project-a/task/task-a/attachment-a-brief.pdf");
  });

  it("creates signed links and deletes the object before metadata", async () => {
    const repo = repository();
    const service = createAttachmentService(repo);
    const attachment = { id: "a", storagePath: "projects/p/task/t/a.pdf" };
    await expect(service.open(attachment)).resolves.toBe("https://signed.example/file");
    await service.remove(attachment);
    expect(repo.removeObject).toHaveBeenCalledWith(attachment.storagePath);
    expect(repo.deleteMetadata).toHaveBeenCalledWith("a");
  });

  it("keeps metadata when object deletion fails and returns a useful error", async () => {
    const repo = repository();
    repo.removeObject.mockRejectedValue(new Error("storage unavailable"));
    const service = createAttachmentService(repo);
    await expect(service.remove({ id: "a", storagePath: "projects/p/task/t/a.pdf" })).rejects.toThrow(/delete/i);
    expect(repo.deleteMetadata).not.toHaveBeenCalled();
  });

  it("rejects an unavailable signed URL", async () => {
    const repo = repository();
    repo.createSignedUrl.mockResolvedValue("");
    const service = createAttachmentService(repo);
    await expect(service.open({ storagePath: "projects/p/task/t/a.pdf" })).rejects.toThrow(/open/i);
  });

  it("cleans all entity attachments before entity deletion", async () => {
    const repo = repository();
    repo.list.mockResolvedValue([{ id: "a", storagePath: "one" }, { id: "b", storagePath: "two" }]);
    const service = createAttachmentService(repo);
    await service.removeAll(context);
    expect(repo.removeObject).toHaveBeenCalledTimes(2);
    expect(repo.deleteMetadata).toHaveBeenCalledTimes(2);
  });

  it("cleans all project attachments before project deletion", async () => {
    const repo = repository();
    repo.listProject.mockResolvedValue([{ id: "a", storagePath: "one" }, { id: "b", storagePath: "two" }]);
    const service = createAttachmentService(repo);
    await service.removeAll({ projectId: "project-a", entityType: "project", entityId: "project-a" });
    expect(repo.listProject).toHaveBeenCalledWith("project-a");
    expect(repo.removeObject).toHaveBeenCalledTimes(2);
    expect(repo.deleteMetadata).toHaveBeenCalledTimes(2);
  });
});
