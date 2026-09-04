import { useEffect, useRef } from "react";
import { Button, IconButton } from "./Button";
import { Icon } from "./icons";
import { cx } from "./primitives";

/**
 * Modal dialog on the native `<dialog>` element: `showModal()` supplies the
 * top layer, the backdrop, focus containment and Escape handling.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  initialFocusRef,
  busy = false,
  role = "dialog",
  className,
  children,
  footer,
  ...rest
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const pressedBackdropRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) {
      return undefined;
    }

    const handleClose = () => onCloseRef.current?.();
    const handleCancel = (event) => {
      if (busyRef.current) {
        event.preventDefault();
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    if (!dialog.open) {
      dialog.showModal();
    }
    initialFocusRef?.current?.focus?.({ preventScroll: true });

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open, initialFocusRef]);

  if (!open) {
    return null;
  }

  // Clicks on the ::backdrop are dispatched to the dialog element itself. A
  // click whose press and release have different targets is dispatched at their
  // common ancestor, so drag-selecting text and releasing over the backdrop also
  // targets the dialog: only dismiss when the press started on the backdrop too.
  const handleBackdropMouseDown = (event) => {
    pressedBackdropRef.current = event.target === dialogRef.current;
  };

  const handleBackdropClick = (event) => {
    const pressedBackdrop = pressedBackdropRef.current;
    pressedBackdropRef.current = false;
    if (pressedBackdrop && event.target === dialogRef.current && !busy) {
      onClose?.();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx("dialog", `dialog-${size}`, busy && "is-busy", className)}
      role={role}
      aria-modal="true"
      aria-label={title}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      {...rest}
    >
      {title ? (
        <div className="dialog-header">
          <div className="dialog-heading">
            <h2 className="dialog-title">{title}</h2>
            {description ? <p className="dialog-description">{description}</p> : null}
          </div>
          <IconButton label="Close" size="sm" disabled={busy} onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </div>
      ) : null}
      <div className="dialog-body">{children}</div>
      {footer ? <div className="dialog-footer">{footer}</div> : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  className,
  children,
  ...rest
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      role="alertdialog"
      className={cx("dialog-confirm", className)}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
      {...rest}
    >
      {description ? <p className="dialog-description">{description}</p> : null}
      {children}
    </Dialog>
  );
}

/** Right-hand drawer. Not modal: the page behind it stays interactive. */
export function SidePanel({
  open,
  onClose,
  ariaLabel,
  header,
  children,
  footer,
  width,
  className,
  ...rest
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (document.querySelector(".dialog")) {
        return;
      }
      event.preventDefault();
      onCloseRef.current?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className={cx("side-panel", className)}
      role="complementary"
      aria-label={ariaLabel}
      style={width ? { width } : undefined}
      {...rest}
    >
      {header ? <div className="side-panel-header">{header}</div> : null}
      <div className="side-panel-body">{children}</div>
      {footer ? <div className="side-panel-footer">{footer}</div> : null}
    </aside>
  );
}
