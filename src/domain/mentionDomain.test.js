import { describe, expect, it } from "vitest";
import { insertMention, mentionEditorValue, parseMentionContent, reconcileMentions, serializeMentionContent } from "./mentionDomain";
import { profileMap } from "./identityDomain";

const adaId = "00000000-0000-4000-8000-000000000101";
const otherId = "00000000-0000-4000-8000-000000000102";

describe("structured mentions", () => {
  it("stores stable IDs while keeping the editor human-readable", () => {
    const inserted = insertMention("Hello", [], { userId: adaId, displayName: "Ada Lovelace" });
    expect(inserted.value).toBe("Hello @Ada Lovelace ");
    expect(serializeMentionContent(inserted.value, inserted.mentions)).toBe(
      `Hello @[Ada%20Lovelace](user:${adaId}) `
    );
  });

  it("keeps duplicate display names unambiguous by ID", () => {
    let draft = insertMention("", [], { userId: adaId, displayName: "Alex" });
    draft = insertMention(draft.value, draft.mentions, { userId: otherId, displayName: "Alex" });
    const stored = serializeMentionContent(draft.value, draft.mentions);
    expect(stored).toContain(`user:${adaId}`);
    expect(stored).toContain(`user:${otherId}`);
  });

  it("parses structured and legacy mentions without rendering UUIDs", () => {
    const profiles = profileMap([{ userId: adaId, displayName: "Ada" }]);
    const source = `Hi @[Old](user:${adaId}) and @${otherId}`;
    const editor = mentionEditorValue(source, profiles);
    expect(editor.value).toBe("Hi @Ada and @TaskFlow user");
    expect(editor.value).not.toMatch(/[0-9a-f]{8}-/i);
    expect(parseMentionContent(source, profiles).filter((part) => part.type === "mention")).toHaveLength(2);
  });

  it("drops mention identity when its visible label is edited", () => {
    const draft = insertMention("", [], { userId: adaId, displayName: "Ada" });
    expect(reconcileMentions(draft.value, "@Ava ", draft.mentions)).toEqual([]);
  });
});
