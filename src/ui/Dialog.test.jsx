import { afterEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ calls: [], onBackdropMouseDown: vi.fn() }));

vi.mock("react", () => ({
  useRef: (initial) => ({ current: initial }),
}));

vi.mock("../components/modal/useModalLifecycle", () => ({
  useModalLifecycle: (options) => {
    lifecycle.calls.push(options);
    return { onBackdropMouseDown: lifecycle.onBackdropMouseDown };
  },
}));

import { ConfirmDialog, Dialog } from "./Dialog";
import { find, findByRole, render, textContent } from "../test/elementTree";

afterEach(() => {
  lifecycle.calls.length = 0;
  vi.clearAllMocks();
});

describe("Dialog", () => {
  it("renders nothing while closed but still drives the modal lifecycle", () => {
    expect(Dialog({ open: false, title: "New task", onClose: vi.fn() })).toBeNull();
    expect(lifecycle.calls[0].isOpen).toBe(false);
  });

  it("renders a labelled modal with body and footer", () => {
    const output = Dialog({
      open: true,
      title: "New task",
      description: "Everything on one screen",
      size: "lg",
      children: "body",
      footer: "footer",
      onClose: vi.fn(),
    });
    const dialog = find(output, (node) => node.props.role === "dialog");

    expect(output.props.className).toBe("dialog-backdrop");
    expect(dialog.props.className).toBe("dialog dialog-lg");
    expect(dialog.props["aria-modal"]).toBe("true");
    expect(dialog.props["aria-label"]).toBe("New task");
    expect(textContent(find(output, (node) => node.props.className === "dialog-body"))).toBe("body");
    expect(textContent(find(output, (node) => node.props.className === "dialog-footer"))).toBe("footer");
  });

  it("closes from the header button and blocks dismissal while busy", () => {
    const onClose = vi.fn();
    const output = render(Dialog({ open: true, title: "New task", busy: true, onClose, children: null }));
    const close = findByRole(output, "button", { name: "Close" });

    expect(close.props.disabled).toBe(true);
    close.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(lifecycle.calls.at(-1).isDismissDisabled).toBe(true);
  });
});

describe("ConfirmDialog", () => {
  it("renders an alertdialog with a danger confirm action", () => {
    const onConfirm = vi.fn();
    const output = render(
      ConfirmDialog({
        open: true,
        title: "Delete project",
        description: "This cannot be undone.",
        confirmLabel: "Delete project",
        danger: true,
        onCancel: vi.fn(),
        onConfirm,
      })
    );
    const dialog = find(output, (node) => node.props.role === "alertdialog");

    expect(dialog.props.className).toBe("dialog dialog-sm dialog-confirm");
    expect(textContent(output)).toContain("This cannot be undone.");

    const confirm = findByRole(output, "button", { name: "Delete project" });
    expect(confirm.props.className).toContain("btn-danger");
    confirm.props.onClick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
