import { IconButton } from "./Button";
import { Icon } from "./icons";
import { cx } from "./cx";

const toneIcon = {
  error: "alert-circle",
  success: "circle-check",
  info: "info",
};

export function InlineNotice({ tone = "info", children, onDismiss, action, className, ...rest }) {
  return (
    <div
      className={cx("notice", `notice-${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
      <span className="notice-icon" aria-hidden="true">
        <Icon name={toneIcon[tone] ?? toneIcon.info} />
      </span>
      <div className="notice-body">{children}</div>
      {action ? <div className="notice-actions">{action}</div> : null}
      {onDismiss ? (
        <IconButton label="Dismiss" size="sm" onClick={onDismiss}>
          <Icon name="x" />
        </IconButton>
      ) : null}
    </div>
  );
}

export default InlineNotice;
