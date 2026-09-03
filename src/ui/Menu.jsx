import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { usePopover } from "./usePopover";

const isSelectable = (item) =>
  Boolean(item) && !item.separator && !item.heading && !item.disabled;

export function Menu({ trigger, items = [], align = "start", className, ...rest }) {
  const { open, toggle, close, rootRef } = usePopover();
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(-1);

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

  const openMenu = () => {
    setActiveIndex(open ? -1 : (selectableIndexes[0] ?? -1));
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
      {open ? (
        <div
          className={cx("menu", align === "end" && "menu-align-end")}
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
        </div>
      ) : null}
    </div>
  );
}

export default Menu;
