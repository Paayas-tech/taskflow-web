import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, Dialog, SidePanel } from "./Dialog";

describe("Dialog", () => {
  it("opens the native dialog modally and renders header, body and footer", () => {
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Edit project"
        description="Rename or recolor it"
        footer={<button type="button">Save</button>}
      >
        <p>Body content</p>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit project" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveClass("dialog", "dialog-md");
    expect(screen.getByRole("heading", { name: "Edit project" })).toHaveClass("dialog-title");
    expect(screen.getByText("Rename or recolor it")).toHaveClass("dialog-description");
    expect(screen.getByText("Body content").parentElement).toHaveClass("dialog-body");
    expect(screen.getByRole("button", { name: "Save" }).parentElement).toHaveClass("dialog-footer");
  });

  it("renders nothing while closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Edit project">
        <p>Body content</p>
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the header button and from a backdrop click", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Edit project">
        <p>Body content</p>
      </Dialog>
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("stays open when a drag that started inside is released on the backdrop", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Edit project">
        <textarea aria-label="Description" defaultValue="Some words" />
      </Dialog>
    );

    // Selecting text and releasing outside dispatches the click at the common
    // ancestor of the press and release targets, which is the dialog itself.
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(screen.getByLabelText("Description"));
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("reports the native close event", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Edit project">
        <p>Body content</p>
      </Dialog>
    );

    screen.getByRole("dialog").close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("refuses to dismiss while busy", () => {
    const onClose = vi.fn();
    render(
      <Dialog open busy onClose={onClose} title="Edit project">
        <p>Body content</p>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("is-busy");
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("focuses the requested element on open", () => {
    function Harness() {
      const inputRef = { current: null };
      return (
        <Dialog open onClose={() => {}} title="Search" initialFocusRef={inputRef}>
          <input
            aria-label="Query"
            ref={(element) => {
              inputRef.current = element;
            }}
          />
        </Dialog>
      );
    }

    render(<Harness />);
    expect(screen.getByLabelText("Query")).toHaveFocus();
  });
});

describe("ConfirmDialog", () => {
  it("is an alertdialog whose actions call back", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete project"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole("alertdialog", { name: "Delete project" });
    expect(dialog).toHaveClass("dialog-confirm", "dialog-sm");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("SidePanel", () => {
  it("renders as a labelled complementary region and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <SidePanel open onClose={onClose} ariaLabel="Task details" header={<h2>Task</h2>}>
        <p>Panel content</p>
      </SidePanel>
    );

    expect(screen.getByRole("complementary", { name: "Task details" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
