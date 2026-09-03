import { cx } from "./cx";

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

export default Spinner;
