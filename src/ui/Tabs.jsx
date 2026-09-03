import { cx } from "./cx";

export function Tabs({ items = [], value, onChange, ariaLabel, className, ...rest }) {
  return (
    <nav className={cx("tabs", className)} role="tablist" aria-label={ariaLabel} {...rest}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("tab", active && "is-active")}
            onClick={() => onChange?.(item.id)}
          >
            {item.icon ? (
              <span className="tab-icon" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            {item.label}
            {typeof item.count === "number" ? <span className="tab-count">{item.count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export default Tabs;
