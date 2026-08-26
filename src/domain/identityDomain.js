export const missingDisplayName = "TaskFlow user";

export const safeDisplayName = (profile) => {
  const candidate = String(profile?.displayName || profile?.display_name || "").trim();
  return candidate || missingDisplayName;
};

export const profileMap = (profiles = []) =>
  new Map(
    profiles
      .filter((profile) => profile?.userId)
      .map((profile) => [
        profile.userId,
        { ...profile, displayName: safeDisplayName(profile) },
      ])
  );

export const resolveDisplayName = (profilesById, userId) =>
  safeDisplayName(profilesById?.get(userId));
