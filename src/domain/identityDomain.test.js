import { describe, expect, it } from "vitest";
import {
  missingDisplayName,
  profileMap,
  resolveDisplayName,
  safeDisplayName,
} from "./identityDomain";

describe("collaboration identity", () => {
  it("normalizes names and never falls back to a raw identifier", () => {
    expect(safeDisplayName({ displayName: "  Ada  " })).toBe("Ada");
    expect(safeDisplayName({ displayName: "" })).toBe(missingDisplayName);
    expect(safeDisplayName(null)).toBe(missingDisplayName);
  });

  it("resolves a batch by internal ID without exposing missing IDs", () => {
    const profiles = profileMap([{ userId: "uuid-a", displayName: "Ada" }]);
    expect(resolveDisplayName(profiles, "uuid-a")).toBe("Ada");
    expect(resolveDisplayName(profiles, "uuid-missing")).toBe("TaskFlow user");
  });
});
