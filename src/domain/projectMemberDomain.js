const memberRoles = new Set(["owner", "member"]);

export const validateMembershipId = (value, label = "Membership ID") => {
  const normalized = String(value || "").trim();

  if (!normalized || normalized.includes("/")) {
    throw new Error(`${label} must be a non-empty Firestore document ID.`);
  }

  return normalized;
};

export const normalizeProjectMemberDocument = (
  ownerId,
  memberId,
  data = {}
) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const normalizedMemberId = validateMembershipId(memberId, "Member ID");
  const userId = validateMembershipId(data.userId, "Member user ID");
  const role = String(data.role || "").trim().toLowerCase();
  const status = String(data.status || "").trim().toLowerCase();
  const addedBy = validateMembershipId(data.addedBy, "Added-by ID");

  if (userId !== normalizedMemberId) {
    throw new Error("Member userId must match the member document ID.");
  }
  if (!memberRoles.has(role)) {
    throw new Error("Project member role must be owner or member.");
  }
  if (status !== "active") {
    throw new Error("Project member status must be active.");
  }
  if (addedBy !== normalizedOwnerId) {
    throw new Error("Project members must be added by the project owner.");
  }
  if (
    (normalizedMemberId === normalizedOwnerId && role !== "owner") ||
    (normalizedMemberId !== normalizedOwnerId && role !== "member")
  ) {
    throw new Error("Project member role does not match the member identity.");
  }

  return {
    id: normalizedMemberId,
    userId,
    role,
    status: "active",
    addedBy,
    joinedAt: data.joinedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    implicit: false,
  };
};

export const buildProjectOwnerMembership = (
  ownerId,
  timestampFactory = () => null
) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");

  return {
    userId: normalizedOwnerId,
    role: "owner",
    status: "active",
    addedBy: normalizedOwnerId,
    joinedAt: timestampFactory(),
    updatedAt: timestampFactory(),
  };
};

export const buildProjectMemberRecord = (
  ownerId,
  memberId,
  data = {},
  timestampFactory = () => null
) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const normalizedMemberId = validateMembershipId(memberId, "Member ID");

  if (normalizedMemberId === normalizedOwnerId) {
    throw new Error("Use ensureProjectOwnerMembership for the project owner.");
  }
  if (
    data.userId !== undefined &&
    validateMembershipId(data.userId, "Member user ID") !== normalizedMemberId
  ) {
    throw new Error("Member userId must match the member document ID.");
  }
  if (data.role !== undefined && String(data.role).toLowerCase().trim() !== "member") {
    throw new Error("Additional project records must use the member role.");
  }
  if (data.status !== undefined && String(data.status).toLowerCase().trim() !== "active") {
    throw new Error("Project member status must be active.");
  }
  if (
    data.addedBy !== undefined &&
    validateMembershipId(data.addedBy, "Added-by ID") !== normalizedOwnerId
  ) {
    throw new Error("Project members must be added by the project owner.");
  }

  return {
    userId: normalizedMemberId,
    role: "member",
    status: "active",
    addedBy: normalizedOwnerId,
    joinedAt: timestampFactory(),
    updatedAt: timestampFactory(),
  };
};

export const withImplicitProjectOwner = (ownerId, members = []) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const explicitOwner = members.find(
    (member) =>
      member.id === normalizedOwnerId &&
      member.userId === normalizedOwnerId &&
      member.role === "owner"
  );

  const owner = explicitOwner || {
    id: normalizedOwnerId,
    userId: normalizedOwnerId,
    role: "owner",
    status: "active",
    addedBy: normalizedOwnerId,
    joinedAt: null,
    updatedAt: null,
    implicit: true,
  };

  return [
    owner,
    ...members.filter((member) => member.id !== normalizedOwnerId),
  ];
};
