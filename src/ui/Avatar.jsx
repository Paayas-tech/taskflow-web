import { cx } from "./cx";

const HUES = [212, 260, 292, 340, 18, 38, 96, 168];

/** Deterministic background color for a person, hashed over eight hues. */
// eslint-disable-next-line react/only-export-components -- avatar palette ships with the Avatar component
export function avatarColor(name) {
  const value = String(name ?? "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return `hsl(${HUES[hash % HUES.length]} 42% 46%)`;
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
        <span
          className={cx("avatar", `avatar-${size}`, "avatar-more")}
          title={`${overflow} more`}
        >
          {`+${overflow}`}
        </span>
      ) : null}
    </span>
  );
}

export default Avatar;
