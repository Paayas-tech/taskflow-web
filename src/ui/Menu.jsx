import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

const MENU_GAP = 4;
const VIEWPORT_GUTTER = 8;
const DEFAULT_MENU_WIDTH = 184;

const placeMenu = (trigger, menu, align) => {
  if (!trigger || typeof window === "undefined") return { top: 0, left: 0 };

  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = menu?.getBoundingClientRect().width || DEFAULT_MENU_WIDTH;
  const menuHeight = menu?.getBoundingClientRect().height || 0;
  const preferredLeft = align === "end" ? triggerRect.right - menuWidth : triggerRect.left;
  const left = Math.min(
    Math.max(VIEWPORT_GUTTER, preferredLeft),
    Math.max(VIEWPORT_GUTTER, window.innerWidth - menuWidth - VIEWPORT_GUTTER)
  );
  const below = triggerRect.bottom + MENU_GAP;
  const above = triggerRect.top - menuHeight - MENU_GAP;
  const top =
    menuHeight > 0 && below + menuHeight > window.innerHeight - VIEWPORT_GUTTER
      ? Math.max(VIEWPORT_GUTTER, above)
      : below;

  return { top, left };
};

/**
 * Open/close state for the menu popover.
 * Closes on outside mousedown and on Escape while open.
 */
function usePopover(popupRef, initialOpen = false) {
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
      const popup = popupRef.current;
      if (root && !root.contains(event.target) && !popup?.contains(event.target)) {
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
  }, [open, popupRef]);

  return { open, setOpen, toggle, close, rootRef };
}

const isSelectable = (item) =>
  Boolean(item) && !item.separator && !item.heading && !item.disabled;

export function Menu({ trigger, items = [], align = "start", className, ...rest }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const { open, toggle, close, rootRef } = usePopover(menuRef);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selectableIndexes = [];
  items.forEach((item, index) => {
    if (isSelectable(item)) {
      selectableIndexes.push(index);
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const target = itemRefs.current[activeIndex];
    if (target) {
      target.focus?.();
    }
  }, [open, activeIndex]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      setPosition(placeMenu(triggerRef.current, menuRef.current, align));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open]);

  const openMenu = () => {
    setActiveIndex(open ? -1 : (selectableIndexes[0] ?? -1));
    if (!open) setPosition(placeMenu(triggerRef.current, null, align));
    toggle();
  };

  const selectItem = (item) => {
    close();
    setActiveIndex(-1);
    item.onSelect?.();
  };

  const moveTo = (position) => {
    if (selectableIndexes.length === 0) {
      return;
    }
    const total = selectableIndexes.length;
    const bounded = ((position % total) + total) % total;
    setActiveIndex(selectableIndexes[bounded]);
  };

  const handleKeyDown = (event) => {
    const position = selectableIndexes.indexOf(activeIndex);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(position === -1 ? 0 : position + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(position === -1 ? selectableIndexes.length - 1 : position - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveTo(selectableIndexes.length - 1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      setActiveIndex(-1);
      triggerRef.current?.focus?.();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const item = items[activeIndex];
      if (isSelectable(item)) {
        event.preventDefault();
        selectItem(item);
      }
    }
  };

  return (
    <div className={cx("menu-wrap", className)} ref={rootRef} {...rest}>
      {trigger?.({
        ref: triggerRef,
        onClick: openMenu,
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="menu"
              style={position}
              role="menu"
              aria-orientation="vertical"
              onKeyDown={handleKeyDown}
            >
              {items.map((item, index) => {
                if (item.separator) {
                  return (
                    <div
                      key={item.id ?? `separator-${index}`}
                      className="menu-separator"
                      role="separator"
                    />
                  );
                }
                if (item.heading) {
                  return (
                    <div
                      key={item.id ?? `heading-${index}`}
                      className="menu-heading"
                      role="presentation"
                    >
                      {item.label}
                    </div>
                  );
                }
                return (
                  <button
                    key={item.id ?? item.label}
                    type="button"
                    role="menuitem"
                    className={cx("menu-item", item.danger && "is-danger")}
                    disabled={item.disabled}
                    tabIndex={index === activeIndex ? 0 : -1}
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    onClick={() => selectItem(item)}
                  >
                    {item.icon ? (
                      <span className="menu-item-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="menu-item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
