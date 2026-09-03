import { Icon } from "./icons";
import { cx } from "./cx";

export function EmptyState({ icon, title, description, action, className, ...rest }) {
  return (
    <div className={cx("empty-state", className)} {...rest}>
      {icon ? (
        <span className="empty-state-icon" aria-hidden="true">
          {typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}
        </span>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
