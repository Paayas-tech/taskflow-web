import { resolveDisplayName } from "./identityDomain";

const uuidPattern = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const storedMentionPattern = new RegExp(`@\\[([^\\]]*)\\]\\(user:(${uuidPattern})\\)|@(${uuidPattern})`, "g");

const safeDecode = (value) => {
  try { return decodeURIComponent(value); } catch { return ""; }
};

export const parseMentionContent = (content, profilesById) => {
  const source = String(content || "");
  const segments = [];
  let cursor = 0;
  for (const match of source.matchAll(storedMentionPattern)) {
    if (match.index > cursor) segments.push({ type: "text", value: source.slice(cursor, match.index) });
    const userId = match[2] || match[3];
    segments.push({
      type: "mention",
      userId,
      label: resolveDisplayName(profilesById, userId),
      legacy: Boolean(match[3]),
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) segments.push({ type: "text", value: source.slice(cursor) });
  return segments;
};

export const mentionEditorValue = (content, profilesById) => {
  const segments = parseMentionContent(content, profilesById);
  let value = "";
  const mentions = [];
  for (const segment of segments) {
    if (segment.type === "text") { value += segment.value; continue; }
    const visible = `@${segment.label}`;
    const start = value.length;
    value += visible;
    mentions.push({ start, end: value.length, userId: segment.userId, label: segment.label });
  }
  return { value, mentions };
};

export const insertMention = (value, mentions, profile) => {
  const label = resolveDisplayName(new Map([[profile.userId, profile]]), profile.userId);
  const prefix = value && !/\s$/.test(value) ? " " : "";
  const start = value.length + prefix.length;
  const visible = `@${label}`;
  return {
    value: `${value}${prefix}${visible} `,
    mentions: [...mentions, { start, end: start + visible.length, userId: profile.userId, label }],
  };
};

export const reconcileMentions = (previousValue, nextValue, mentions) => {
  let prefix = 0;
  while (prefix < previousValue.length && prefix < nextValue.length && previousValue[prefix] === nextValue[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previousValue.length - prefix && suffix < nextValue.length - prefix && previousValue[previousValue.length - 1 - suffix] === nextValue[nextValue.length - 1 - suffix]) suffix += 1;
  const oldEnd = previousValue.length - suffix;
  const delta = nextValue.length - previousValue.length;
  return mentions.flatMap((mention) => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    return [];
  });
};

export const serializeMentionContent = (value, mentions) => {
  let result = String(value || "");
  [...mentions].sort((a, b) => b.start - a.start).forEach((mention) => {
    const visible = result.slice(mention.start, mention.end);
    if (visible !== `@${mention.label}`) return;
    const token = `@[${encodeURIComponent(mention.label)}](user:${mention.userId})`;
    result = `${result.slice(0, mention.start)}${token}${result.slice(mention.end)}`;
  });
  return result;
};

export const storedMentionLabel = (encoded) => safeDecode(encoded);
