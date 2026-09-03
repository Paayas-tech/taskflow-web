import { cx } from "./cx";

export function Kbd({ className, children, ...rest }) {
  return (
    <kbd className={cx("kbd", className)} {...rest}>
      {children}
    </kbd>
  );
}

export default Kbd;
