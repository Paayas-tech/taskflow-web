import { cx } from "./cx";
import { Spinner } from "./Spinner";

export function Button({
  variant = "secondary",
  size = "md",
  icon = null,
  loading = false,
  type = "button",
  disabled = false,
  className,
  children,
  ref,
  ...rest
}) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", loading && "is-loading", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : null}
      {!loading && icon ? (
        <span className="btn-leading" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  size = "md",
  variant = "ghost",
  type = "button",
  className,
  children,
  ref,
  ...rest
}) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("btn", "btn-icon", `btn-${variant}`, size === "sm" && "btn-sm", className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
