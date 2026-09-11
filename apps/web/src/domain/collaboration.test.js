import { describe, expect, it } from "vitest";
import {
  filterInboxNotifications,
  insertMention,
  mentionEditorValue,
  notificationLabel,
  notificationTypeLabel,
  parseMentionContent,
  profileMap,
  reconcileMentions,
  safeDisplayName,
  serializeMentionContent,
} from "./collaboration";

const adaId = "00000000-0000-4000-8000-000000000101";
const otherId = "00000000-0000-4000-8000-000000000102";

describe("display identity", () => {
  it.each([
    [{ displayName: "  Ada  " }, "Ada"],
    [{ display_name: "Row name" }, "Row name"],
    [{ displayName: "" }, "TaskFlow user"],
    [null, "TaskFlow user"],
  ])("names %o safely", (profile, expected) => {
    expect(safeDisplayName(profile)).toBe(expected);
  });

  it("indexes profiles by id and drops entries without one", () => {
    const profiles = profileMap([
      { userId: adaId, displayName: "Ada" },
      { displayName: "Nobody" },
    ]);

    expect(profiles.size).toBe(1);
    expect(profiles.get(adaId).displayName).toBe("Ada");
  });
});

describe("structured mentions", () => {
  it("stores stable IDs while keeping the editor human-readable", () => {
    const inserted = insertMention("Hello", [], {
      userId: adaId,
      displayName: "Ada Lovelace",
    });

    expect(inserted.value).toBe("Hello @Ada Lovelace ");
    expect(serializeMentionContent(inserted.value, inserted.mentions)).toBe(
      `Hello @[Ada%20Lovelace](user:${adaId}) `
    );
  });

  it("keeps duplicate display names unambiguous by ID", () => {
    let draft = insertMention("", [], { userId: adaId, displayName: "Alex" });
    draft = insertMention(draft.value, draft.mentions, {
      userId: otherId,
      displayName: "Alex",
    });
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
    expect(
      parseMentionContent(source, profiles).filter((part) => part.type === "mention")
    ).toHaveLength(2);
  });

  it("drops mention identity when its visible label is edited", () => {
    const draft = insertMention("", [], { userId: adaId, displayName: "Ada" });

    expect(reconcileMentions(draft.value, "@Ava ", draft.mentions)).toEqual([]);
  });

  it("keeps a mention when the edit happens after it", () => {
    const draft = insertMention("", [], { userId: adaId, displayName: "Ada" });
    const next = `${draft.value}please review`;

    expect(reconcileMentions(draft.value, next, draft.mentions)).toEqual(
      draft.mentions
    );
  });
});

describe("notification inbox", () => {
  const notifications = [
    {
      id: "read",
      type: "comment_added",
      readAt: "2026-08-26T10:00:00Z",
      createdAt: "2026-08-26T10:00:00Z",
      data: { taskTitle: "Plan" },
      actorName: "Riya",
    },
    {
      id: "mention",
      type: "mentioned",
      readAt: null,
      createdAt: "2026-08-26T12:00:00Z",
      data: { taskTitle: "Review" },
      actorName: "Dev",
    },
    {
      id: "assigned",
      type: "task_assigned",
      readAt: null,
      createdAt: "2026-08-26T11:00:00Z",
      data: { taskTitle: "Ship" },
    },
  ];

  it("creates human-readable labels without exposing identifiers", () => {
    expect(notificationLabel(notifications[0])).toBe("Riya added a comment to Plan.");
    expect(notificationLabel(notifications[1])).toBe("Dev mentioned you on Review.");
    expect(notificationLabel(notifications[2])).toBe("You were assigned Ship.");
    expect(notificationTypeLabel("mentioned")).toBe("Mention");
    expect(notificationTypeLabel("unknown")).toBe("Update");
  });

  it("filters unread and mentioned activity and sorts both directions", () => {
    expect(
      filterInboxNotifications(notifications, { view: "unread" }).map(({ id }) => id)
    ).toEqual(["mention", "assigned"]);
    expect(
      filterInboxNotifications(notifications, { view: "mentioned" }).map(
        ({ id }) => id
      )
    ).toEqual(["mention"]);
    expect(
      filterInboxNotifications(notifications, { type: "task_assigned" }).map(
        ({ id }) => id
      )
    ).toEqual(["assigned"]);
    expect(
      filterInboxNotifications(notifications, { sort: "oldest" }).map(({ id }) => id)
    ).toEqual(["read", "assigned", "mention"]);
  });
});
