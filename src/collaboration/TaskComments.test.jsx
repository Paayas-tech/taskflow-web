import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  let active;
  return {
    activate(value) { active = value; },
    useState(initial) {
      const index = active.cursor++;
      active.slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      const slot = active.slots[index];
      return [slot.value, (next) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useRef(initial) {
      const index = active.cursor++;
      active.slots[index] ??= { current: initial };
      return active.slots[index];
    },
  };
});

const service = vi.hoisted(() => ({
  createTaskComment: vi.fn(), deleteTaskComment: vi.fn(), getTaskComments: vi.fn(),
  subscribeToTaskComments: vi.fn(), updateTaskComment: vi.fn(),
}));
vi.mock("react", () => ({
  useCallback: (callback) => callback,
  useEffect: () => undefined,
  useRef: runtime.useRef,
  useState: runtime.useState,
}));
vi.mock("../application/projectService", () => service);
import CommentRow from "./CommentRow";
import TaskComments from "./TaskComments";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter((child) => child !== null && child !== undefined && child !== false);
};
const walk = (node, visit) => {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node); childrenOf(node).forEach((child) => walk(child, visit));
};
const findAll = (root, predicate) => { const found = []; walk(root, (node) => predicate(node) && found.push(node)); return found; };
const text = (node) => typeof node === "string" ? node : childrenOf(node).map(text).join("");
const byLabel = (root, label) => findAll(root, (node) => node.props?.["aria-label"] === label)[0];
const menuItems = (root) => findAll(root, (node) => Array.isArray(node.props?.items))[0]?.props.items ?? [];
const confirmDialog = (root) =>
  findAll(root, (node) => node.props?.title === "Delete this comment?")[0];
const runner = (component) => ({
  slots: [], cursor: 0,
  render() { this.cursor = 0; runtime.activate(this); this.tree = component(); return this.tree; },
});

const memberA = { userId: "00000000-0000-4000-8000-000000000101", displayName: "Alex", role: "editor" };
const memberB = { userId: "00000000-0000-4000-8000-000000000102", displayName: "Alex", role: "viewer" };

describe("TaskComments structured mention UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("labels the composer and submits with the Comment button", () => {
    const view = runner(() => TaskComments({ userId: "owner", taskId: "task", members: [] }));
    const tree = view.render();
    const composer = byLabel(tree, "Write a comment");

    expect(composer.props.placeholder).toBe("Write a comment");
    expect(composer.props.id).toBe("comment-task");
    expect(findAll(tree, (node) => text(node) === "Comment" && node.props?.type === "submit")).toHaveLength(1);
  });

  it("offers only supplied project members and stores the selected member ID", async () => {
    const view = runner(() => TaskComments({ userId: "owner", taskId: "task", members: [memberA, memberB] }));
    let tree = view.render();
    const mentionButtons = findAll(tree, (node) => node.type === "button" && text(node) === "@Alex");
    expect(mentionButtons).toHaveLength(2);
    mentionButtons[1].props.onClick();
    tree = view.render();
    const textarea = byLabel(tree, "Write a comment");
    expect(textarea.props.value).toBe("@Alex ");
    expect(textarea.props.value).not.toContain(memberB.userId);
    await findAll(tree, (node) => node.type === "form")[0].props.onSubmit({ preventDefault: vi.fn() });
    expect(service.createTaskComment).toHaveBeenCalledWith(
      "owner", "task", `@[Alex](user:${memberB.userId}) `
    );
  });

  it("renders structured and legacy mentions by name and uses a safe fallback", () => {
    const profiles = new Map([[memberA.userId, memberA]]);
    const comment = {
      id: "comment", userId: memberA.userId, displayName: "Alex",
      content: `Hi @[Alex](user:${memberA.userId}) and @${memberB.userId}`,
    };
    const view = runner(() => CommentRow({ comment, currentUserId: "other", profilesById: profiles, onUpdate: vi.fn(), onDelete: vi.fn() }));
    const visible = text(view.render());
    expect(visible).toContain("@Alex");
    expect(visible).toContain("@TaskFlow user");
    expect(visible).not.toContain(memberA.userId);
    expect(visible).not.toContain(memberB.userId);
  });

  it("opens structured comments for editing without exposing stored IDs", () => {
    const profiles = new Map([[memberA.userId, memberA]]);
    const comment = { id: "comment", userId: memberA.userId, displayName: "Alex", content: `Hi @[Alex](user:${memberA.userId})` };
    const view = runner(() => CommentRow({ comment, currentUserId: memberA.userId, profilesById: profiles, mentionCandidates: [memberA], onUpdate: vi.fn(), onDelete: vi.fn() }));
    let tree = view.render();
    const edit = menuItems(tree).find((item) => item.id === "edit");
    expect(edit.label).toBe("Edit");
    edit.onSelect();
    tree = view.render();
    const textarea = byLabel(tree, "Edit comment");
    expect(textarea.props.value).toBe("Hi @Alex");
    expect(textarea.props.value).not.toContain(memberA.userId);
  });

  it("keeps delete on the author menu and confirms in a dialog before removing", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const comment = { id: "comment", userId: memberA.userId, displayName: "Alex", content: "Ship it" };
    const view = runner(() => CommentRow({ comment, currentUserId: memberA.userId, profilesById: new Map(), onUpdate: vi.fn(), onDelete }));
    let tree = view.render();
    const remove = menuItems(tree).find((item) => item.id === "delete");

    expect(remove.danger).toBe(true);
    expect(confirmDialog(tree).props.open).toBe(false);

    remove.onSelect();
    tree = view.render();

    const dialog = confirmDialog(tree);
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.danger).toBe(true);
    expect(dialog.props.confirmLabel).toBe("Delete");
    expect(onDelete).not.toHaveBeenCalled();

    await dialog.props.onConfirm();

    expect(onDelete).toHaveBeenCalledWith("comment");
  });
});
