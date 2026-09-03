/** Joins class name parts, dropping falsy values. */
export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export default cx;
