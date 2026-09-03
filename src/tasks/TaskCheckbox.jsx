import { Icon } from "../ui/icons";
import { Spinner } from "../ui/Spinner";
import { cx } from "../ui/cx";

/**
 * The round completion control used by rows, cards and the detail panel.
 * Stops click and key events from reaching a clickable parent row.
 */
export function TaskCheckbox({
  checked = false,
  onChange,
  disabled = false,
  busy = false,
  label,
  size = "md",
  className,
  ...rest
}) {
  const handleClick = (event) => {
    event.stopPropagation();
    if (disabled || busy) return;
    onChange?.(!checked, event);
  };

  const handleKeyDown = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.stopPropagation();
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={cx(
        "task-check",
        size === "sm" && "task-check-sm",
        checked && "is-complete",
        busy && "is-busy",
        className
      )}
      disabled={disabled || busy}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {busy ? <Spinner size="sm" /> : <Icon name="check" size={12} className="task-check-mark" />}
    </button>
  );
}

export default TaskCheckbox;
