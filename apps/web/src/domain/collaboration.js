/**
 * Collaboration domain: display identity, comment mentions and the
 * notification inbox. Pure functions, no React and no api access.
 */

const missingDisplayName = "TaskFlow user";

const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const storedMentionPattern = new RegExp(
  `@\\[([^\\]]*)\\]\\(user:(${uuidPattern})\\)|@(${uuidPattern})`,
  "g"
);

/** A person's name, never a raw identifier. */
export const safeDisplayName = (profile) => {
  const candidate = String(
    profile?.displayName || profile?.display_name || ""
  ).trim();
  return candidate || missingDisplayName;
};

/** `Map<userId, profile>` with every name already made safe. */
export const profileMap = (profiles = []) =>
  new Map(
    profiles
      .filter((profile) => profile?.userId)
      .map((profile) => [
        profile.userId,
        { ...profile, displayName: safeDisplayName(profile) },
      ])
  );

const resolveDisplayName = (profilesById, userId) =>
  safeDisplayName(profilesById?.get(userId));

/**
 * Splits stored comment content into text and mention segments. Both the
 * structured `@[Name](user:uuid)` form and the legacy bare `@uuid` form are
 * understood; neither ever renders as an identifier.
 */
export const parseMentionContent = (content, profilesById) => {
  const source = String(content || "");
  const segments = [];
  let cursor = 0;
  for (const match of source.matchAll(storedMentionPattern)) {
    if (match.index > cursor) {
      segments.push({ type: "text", value: source.slice(cursor, match.index) });
    }
    const userId = match[2] || match[3];
    segments.push({
      type: "mention",
      userId,
      label: resolveDisplayName(profilesById, userId),
      legacy: Boolean(match[3]),
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    segments.push({ type: "text", value: source.slice(cursor) });
  }
  return segments;
};

/** Stored content turned into the human-readable editor value + mention spans. */
export const mentionEditorValue = (content, profilesById) => {
  const segments = parseMentionContent(content, profilesById);
  let value = "";
  const mentions = [];
  for (const segment of segments) {
    if (segment.type === "text") {
      value += segment.value;
      continue;
    }
    const visible = `@${segment.label}`;
    const start = value.length;
    value += visible;
    mentions.push({
      start,
      end: value.length,
      userId: segment.userId,
      label: segment.label,
    });
  }
  return { value, mentions };
};

export const insertMention = (value, mentions, profile) => {
  const label = resolveDisplayName(
    new Map([[profile.userId, profile]]),
    profile.userId
  );
  const prefix = value && !/\s$/.test(value) ? " " : "";
  const start = value.length + prefix.length;
  const visible = `@${label}`;
  return {
    value: `${value}${prefix}${visible} `,
    mentions: [
      ...mentions,
      { start, end: start + visible.length, userId: profile.userId, label },
    ],
  };
};

/** Keeps mention spans aligned with an edit, dropping any the edit touched. */
export const reconcileMentions = (previousValue, nextValue, mentions) => {
  let prefix = 0;
  while (
    prefix < previousValue.length &&
    prefix < nextValue.length &&
    previousValue[prefix] === nextValue[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previousValue.length - prefix &&
    suffix < nextValue.length - prefix &&
    previousValue[previousValue.length - 1 - suffix] ===
      nextValue[nextValue.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldEnd = previousValue.length - suffix;
  const delta = nextValue.length - previousValue.length;
  return mentions.flatMap((mention) => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= oldEnd) {
      return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    }
    return [];
  });
};

/** Editor value + spans turned back into the stored `@[Name](user:uuid)` form. */
export const serializeMentionContent = (value, mentions) => {
  let result = String(value || "");
  [...mentions]
    .sort((first, second) => second.start - first.start)
    .forEach((mention) => {
      const visible = result.slice(mention.start, mention.end);
      if (visible !== `@${mention.label}`) return;
      const token = `@[${encodeURIComponent(mention.label)}](user:${mention.userId})`;
      result = `${result.slice(0, mention.start)}${token}${result.slice(mention.end)}`;
    });
  return result;
};

export const notificationLabel = (notification) => {
  const task = notification.data?.taskTitle || "a task";
  const actor = notification.actorName
    ? `${safeDisplayName({ displayName: notification.actorName })} `
    : "";
  if (notification.type === "task_assigned") return `You were assigned ${task}.`;
  if (notification.type === "mentioned") return `${actor}mentioned you on ${task}.`;
  return `${actor}added a comment to ${task}.`;
};

export const notificationTypeLabel = (type) =>
  ({
    task_assigned: "Assignment",
    comment_added: "Comment",
    mentioned: "Mention",
  })[type] || "Update";

export const filterInboxNotifications = (
  notifications,
  { view = "activity", type = "all", sort = "newest" } = {}
) => {
  const filtered = notifications.filter((notification) => {
    if (view === "unread" && notification.readAt) return false;
    if (view === "mentioned" && notification.type !== "mentioned") return false;
    return type === "all" || notification.type === type;
  });
  return [...filtered].sort((first, second) => {
    const comparison = String(second.createdAt || "").localeCompare(
      String(first.createdAt || "")
    );
    return sort === "oldest" ? -comparison : comparison;
  });
};
