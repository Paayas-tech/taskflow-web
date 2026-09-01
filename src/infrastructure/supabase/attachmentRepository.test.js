import { describe, expect, it, vi } from "vitest";
import { ATTACHMENT_BUCKET } from "../../domain/attachmentDomain";
import { createAttachmentRepository } from "./attachmentRepository";

const storageClient = ({ uploadData = {}, uploadError = null, signedData = { signedUrl: "https://signed.example/a" }, signedError = null } = {}) => {
  const upload = vi.fn().mockResolvedValue({ data: uploadData, error: uploadError });
  const remove = vi.fn().mockResolvedValue({ data: {}, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: signedData, error: signedError });
  const from = vi.fn(() => ({ upload, remove, createSignedUrl }));
  return { client: { storage: { from } }, from, upload, remove, createSignedUrl };
};

describe("attachment repository storage", () => {
  it("uploads to the private attachment bucket without upsert", async () => {
    const storage = storageClient();
    const repository = createAttachmentRepository(storage.client);
    const file = { type: "application/pdf" };
    await repository.uploadObject("projects/p/task/t/a-file.pdf", file);
    expect(storage.from).toHaveBeenCalledWith(ATTACHMENT_BUCKET);
    expect(storage.upload).toHaveBeenCalledWith("projects/p/task/t/a-file.pdf", file, {
      contentType: "application/pdf", upsert: false,
    });
  });

  it("uses a short-lived signed URL and rejects missing URLs", async () => {
    const storage = storageClient();
    const repository = createAttachmentRepository(storage.client);
    await expect(repository.createSignedUrl("projects/p/task/t/a-file.pdf")).resolves.toBe("https://signed.example/a");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("projects/p/task/t/a-file.pdf", 60);

    const missing = storageClient({ signedData: {} });
    await expect(createAttachmentRepository(missing.client).createSignedUrl("missing")).rejects.toThrow(/unavailable/i);
  });

  it("propagates Storage failures and removes only the requested object", async () => {
    const failing = storageClient({ uploadError: new Error("denied") });
    await expect(createAttachmentRepository(failing.client).uploadObject("blocked", {})).rejects.toThrow("denied");

    const storage = storageClient();
    await createAttachmentRepository(storage.client).removeObject("projects/p/story/s/a-file.pdf");
    expect(storage.remove).toHaveBeenCalledWith(["projects/p/story/s/a-file.pdf"]);
  });
});
