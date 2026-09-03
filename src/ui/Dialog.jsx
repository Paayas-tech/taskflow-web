import { useRef } from "react";
import { useModalLifecycle } from "../components/modal/useModalLifecycle";
import { Button, IconButton } from "./Button";
import { Icon } from "./icons";
import { cx } from "./cx";

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  initialFocusRef,
  busy = false,
  className,
  children,
  footer,
  ...rest
}) {
  const dialogRef = useRef(null);
  const { onBackdropMouseDown } = useModalLifecycle({
    isOpen: Boolean(open),
    modalRef: dialogRef,
    onClose,
    initialFocusRef,
    isDismissDisabled: busy,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        ref={dialogRef}
        className={cx("dialog", `dialog-${size}`, busy && "is-busy", className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
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
      </div>
    </div>
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
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
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

export default Dialog;
