import { describe, expect, it, vi } from "vitest";
import {
  buildProjectMemberRecord,
  buildProjectOwnerMembership,
  normalizeProjectMemberDocument,
  validateMembershipId,
  withImplicitProjectOwner,
} from "./projectMemberDomain";

describe("project membership identifiers", () => {
  it("normalizes valid IDs and rejects empty or path-like IDs", () => {
    expect(validateMembershipId(" owner-1 ", "Owner ID")).toBe("owner-1");
    expect(() => validateMembershipId("", "Owner ID")).toThrow(/Owner ID/);
    expect(() => validateMembershipId("users/member", "Member ID")).toThrow(
      /Member ID/
    );
  });
});

describe("project owner membership", () => {
  it("builds a deterministic owner record", () => {
    const timestampFactory = vi
      .fn()
      .mockReturnValueOnce("joined")
      .mockReturnValueOnce("updated");

    expect(buildProjectOwnerMembership("owner-1", timestampFactory)).toEqual({
      userId: "owner-1",
      role: "owner",
      status: "active",
      addedBy: "owner-1",
      joinedAt: "joined",
      updatedAt: "updated",
    });
  });

  it("treats a missing explicit record as an implicit owner", () => {
    expect(withImplicitProjectOwner("owner-1", [])).toEqual([
      expect.objectContaining({
        id: "owner-1",
        userId: "owner-1",
        role: "owner",
        implicit: true,
      }),
    ]);

    const explicitOwner = {
      id: "owner-1",
      userId: "owner-1",
      role: "owner",
      status: "active",
      addedBy: "owner-1",
      implicit: false,
    };
    expect(withImplicitProjectOwner("owner-1", [explicitOwner])[0]).toBe(
      explicitOwner
    );
  });
});

describe("additional project member records", () => {
  it("builds only active member records with immutable identity semantics", () => {
    const record = buildProjectMemberRecord(
      "owner-1",
      "member-1",
      { userId: "member-1", role: "member", status: "active" },
      () => "server-time"
    );

    expect(record).toEqual({
      userId: "member-1",
      role: "member",
      status: "active",
      addedBy: "owner-1",
      joinedAt: "server-time",
      updatedAt: "server-time",
    });
    expect(() =>
      buildProjectMemberRecord("owner-1", "owner-1")
    ).toThrow(/ensureProjectOwnerMembership/);
    expect(() =>
      buildProjectMemberRecord("owner-1", "member-1", { role: "owner" })
    ).toThrow(/member role/);
    expect(() =>
      buildProjectMemberRecord("owner-1", "member-1", {
        userId: "different-member",
      })
    ).toThrow(/must match/);
  });

  it("rejects malformed persisted identities and role escalation", () => {
    expect(() =>
      normalizeProjectMemberDocument("owner-1", "member-1", {
        userId: "member-1",
        role: "owner",
        status: "active",
        addedBy: "owner-1",
      })
    ).toThrow(/role does not match/);

    expect(
      normalizeProjectMemberDocument("owner-1", "member-1", {
        userId: "member-1",
        role: "member",
        status: "active",
        addedBy: "owner-1",
      })
    ).toMatchObject({
      id: "member-1",
      role: "member",
      implicit: false,
    });
  });
});
