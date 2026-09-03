import { cx } from "./cx";

export function Badge({ tone = "neutral", dot = false, className, children, ...rest }) {
  return (
    <span className={cx("badge", `badge-${tone}`, className)} {...rest}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default Badge;
