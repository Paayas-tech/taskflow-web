import { Button, InlineNotice } from "../ui";
import { cx } from "../ui/cx";

/** Card shell shared by the four Home widgets. */
export function Widget({ title, actions, footer, children, className, ...rest }) {
  return (
    <section className={cx("widget", className)} aria-label={title} {...rest}>
      <header className="widget-header">
        <h2 className="widget-title">{title}</h2>
        {actions ? <div className="widget-actions">{actions}</div> : null}
      </header>
      <div className="widget-body">{children}</div>
      {footer ? <div className="widget-footer">{footer}</div> : null}
    </section>
  );
}

/** Placeholder rows shown while a widget loads. */
export function WidgetSkeleton({ rows = 3, label = "Loading" }) {
  return (
    <div className="widget-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} aria-hidden="true">
          <span className="skeleton widget-skeleton-mark" />
          <span className="skeleton widget-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

/** A failed load inside a widget, with the retry the page owns. */
export function WidgetError({ message, onRetry }) {
  return (
    <InlineNotice
      tone="error"
      className="widget-notice"
      action={
        onRetry ? (
          <Button size="sm" onClick={() => onRetry()}>
            Retry
          </Button>
        ) : null
      }
    >
      {message}
    </InlineNotice>
  );
}

export default Widget;
