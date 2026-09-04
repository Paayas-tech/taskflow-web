import { cx } from "./primitives";

export function Field({ label, hint, error, htmlFor, inline = false, className, children, ...rest }) {
  return (
    <div className={cx("field", inline && "field-inline", className)} {...rest}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      <div className="field-control">{children}</div>
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ invalid = false, className, ref, ...rest }) {
  return (
    <input
      ref={ref}
      className={cx("input", invalid && "is-invalid", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({ invalid = false, className, ref, ...rest }) {
  return (
    <textarea
      ref={ref}
      className={cx("textarea", invalid && "is-invalid", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ invalid = false, className, children, ref, ...rest }) {
  return (
    <select
      ref={ref}
      className={cx("select", invalid && "is-invalid", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ref, ...rest }) {
  return (
    <label className={cx("checkbox", className)}>
      <input type="checkbox" ref={ref} {...rest} />
      {label ? <span className="checkbox-label">{label}</span> : null}
    </label>
  );
}
