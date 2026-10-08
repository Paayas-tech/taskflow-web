import { describe, expect, it } from "vitest";
import { isValidDateKey, localDateKey } from "../../../mobile/src/lib/dates";

describe("mobile calendar dates", () => {
  it("uses the local calendar day instead of UTC", () => {
    const date = new Date(2026, 9, 8, 0, 15);
    expect(localDateKey(date)).toBe("2026-10-08");
  });
  it("rejects malformed and impossible dates", () => {
    for (const value of ["2026-02-30", "2026-13-01", "2026-2-1", "bad"])
      expect(isValidDateKey(value)).toBe(false);
    expect(isValidDateKey("2028-02-29")).toBe(true);
  });
});
