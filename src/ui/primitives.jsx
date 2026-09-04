import { IconButton } from "./Button";
import { Icon } from "./icons";

/** Joins class name parts, dropping falsy values. */
// eslint-disable-next-line react/only-export-components -- every primitive here composes class names with cx
export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

/* ---------- Badge ---------- */

export function Badge({ tone = "neutral", dot = false, className, children, ...rest }) {
  return (
    <span className={cx("badge", `badge-${tone}`, className)} {...rest}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ---------- Kbd ---------- */

export function Kbd({ className, children, ...rest }) {
  return (
    <kbd className={cx("kbd", className)} {...rest}>
      {children}
    </kbd>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ size = "md", className, ...rest }) {
  return (
    <span
      className={cx("spinner", `spinner-${size}`, className)}
      role="status"
      aria-label="Loading"
      {...rest}
    />
  );
}

/* ---------- EmptyState ---------- */

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

/* ---------- InlineNotice ---------- */

const noticeToneIcon = {
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
        <Icon name={noticeToneIcon[tone] ?? noticeToneIcon.info} />
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

/* ---------- Avatar ---------- */

const AVATAR_HUES = [212, 260, 292, 340, 18, 38, 96, 168];

/** Deterministic background color for a person, hashed over eight hues. */
function avatarColor(name) {
  const value = String(name ?? "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return `hsl(${AVATAR_HUES[hash % AVATAR_HUES.length]} 42% 46%)`;
}

function initials(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name = "", size = "sm", src = "", className, ...rest }) {
  const label = String(name ?? "").trim();

  return (
    <span
      className={cx("avatar", `avatar-${size}`, className)}
      title={label || undefined}
      style={src ? undefined : { backgroundColor: avatarColor(label) }}
      {...rest}
    >
      {src ? <img className="avatar-image" src={src} alt="" /> : initials(label)}
    </span>
  );
}

export function AvatarStack({ people = [], max = 3, size = "sm", className, ...rest }) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <span className={cx("avatar-stack", className)} {...rest}>
      {visible.map((person, index) => (
        <Avatar
          key={person.id ?? person.name ?? index}
          name={person.name}
          src={person.src}
          size={size}
        />
      ))}
      {overflow > 0 ? (
        <span className={cx("avatar", `avatar-${size}`, "avatar-more")} title={`${overflow} more`}>
          {`+${overflow}`}
        </span>
      ) : null}
    </span>
  );
}

/* ---------- Tabs ---------- */

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

/* ---------- SegmentedControl ---------- */

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
