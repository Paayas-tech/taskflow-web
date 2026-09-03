import { cx } from "./cx";

export function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
  ...rest
}) {
  return (
    <div
      className={cx("segmented", size === "sm" && "segmented-sm", className)}
      role="group"
      aria-label={ariaLabel}
      {...rest}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={cx("segmented-option", active && "is-active")}
            onClick={() => onChange?.(option.id)}
          >
            {option.icon ? (
              <span className="segmented-icon" aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            {option.label}
            {typeof option.count === "number" ? (
              <span className="segmented-count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
