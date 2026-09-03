import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Open/close state for popovers, menus and pickers.
 * Closes on outside mousedown and on Escape while open.
 */
export function usePopover(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const handleMouseDown = (event) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle, close, rootRef };
}

export default usePopover;
