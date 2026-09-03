import { useEffect, useRef } from "react";
import { cx } from "./cx";

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

export default SidePanel;
