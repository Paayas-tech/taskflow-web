import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentSection } from "./AttachmentSection";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";

const makeAttachment = (overrides = {}) => ({
  id: "attachment-1",
  projectId: "project-1",
  entityType: "task",
  entityId: "task-1",
  storagePath: "projects/project-1/task/task-1/attachment-1-brief.pdf",
  fileName: "brief.pdf",
  contentType: "application/pdf",
  sizeBytes: 2048,
  uploadedBy: "user-1",
  uploaderName: "Sam Rivera",
  uploaderAvatarUrl: "",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const pdf = (name = "notes.pdf") =>
  new File(["a report"], name, { type: "application/pdf" });

/** Rendered the way the task panel renders it: one task, the viewer can manage. */
const renderSection = (props = {}) =>
  renderPage(
    <AttachmentSection
      projectId="project-1"
      entityType="task"
      entityId="task-1"
      canManage
      {...props}
    />
  );

describe("AttachmentSection", () => {
  it("lists the files on the task and mirrors the count into the store", async () => {
    const { api } = await seedStore({ attachments: [makeAttachment()] });
    renderSection();

    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2 KB · Sam Rivera/)).toBeInTheDocument();
    expect(api.callsOf("listAttachments")[0][0]).toEqual({
      projectId: "project-1",
      entityType: "task",
      entityId: "task-1",
    });
    await waitFor(() => expect(getState().attachmentCounts["task-1"]).toBe(1));
  });

  it("uploads the chosen file against this task", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore();
    renderSection();

    expect(await screen.findByText("No attachments")).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Choose a file to upload"), pdf());

    expect(await screen.findByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("Uploaded · saved automatically.")).toBeInTheDocument();

    const [payload] = api.callsOf("uploadAttachment")[0];
    expect(payload).toMatchObject({
      projectId: "project-1",
      entityType: "task",
      entityId: "task-1",
      userId: "user-1",
      uploaderName: "Sam Rivera",
    });
    expect(payload.file.name).toBe("notes.pdf");
    expect(getState().attachmentCounts["task-1"]).toBe(1);
  });

  it("reports a failed upload and adds nothing", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore();
    api.failNext("uploadAttachment", new Error("Files must be 10 MB or smaller."));
    renderSection();

    await screen.findByText("No attachments");
    await user.upload(screen.getByLabelText("Choose a file to upload"), pdf());

    expect(
      await screen.findByText("Files must be 10 MB or smaller.")
    ).toBeInTheDocument();
    expect(screen.queryByText("notes.pdf")).toBeNull();
    expect(getState().attachmentCounts["task-1"]).toBe(0);
  });

  it("deletes a file only after the confirmation", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({ attachments: [makeAttachment()] });
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: "Actions for brief.pdf" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete attachment?" });
    expect(api.callCount("removeAttachment")).toBe(0);

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(api.callCount("removeAttachment")).toBe(1));
    expect(api.callsOf("removeAttachment")[0][0].id).toBe("attachment-1");
    expect(await screen.findByText("No attachments")).toBeInTheDocument();
    expect(screen.queryByText("brief.pdf")).toBeNull();
    expect(getState().attachmentCounts["task-1"]).toBe(0);
  });

  it("offers a retry when the list cannot be read", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({ attachments: [makeAttachment()] });
    api.failNext("listAttachments", new Error("offline"));
    renderSection();

    expect(await screen.findByText("Failed to load attachments.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    expect(api.callCount("listAttachments")).toBe(2);
  });

  it("hides the upload and delete affordances from a viewer", async () => {
    const user = userEvent.setup();
    await seedStore({ attachments: [makeAttachment()] });
    renderSection({ canManage: false });

    await screen.findByText("brief.pdf");
    expect(screen.queryByLabelText("Choose a file to upload")).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Actions for brief.pdf" }));
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });
});
