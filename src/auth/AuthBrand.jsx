import { Icon } from "../ui";

/** Mark + wordmark shown at the top of every auth card. */
export function AuthBrand() {
  return (
    <div className="auth-brand">
      <span className="auth-mark" aria-hidden="true">
        <Icon name="check" size={13} />
      </span>
      <span className="auth-wordmark">TaskFlow</span>
    </div>
  );
}
