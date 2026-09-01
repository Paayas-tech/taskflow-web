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
    useEffect(effect) {
      const index = active.cursor++;
      if (!active.slots[index]) {
        active.slots[index] = { mounted: true };
        active.effects.push(effect);
      }
    },
  };
});

const service = vi.hoisted(() => ({
  list: vi.fn(), upload: vi.fn(), open: vi.fn(), remove: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: (callback) => callback,
  useEffect: runtime.useEffect,
  useRef: runtime.useRef,
  useState: runtime.useState,
}));
vi.mock("./application/attachmentService", () => ({ attachmentService: service }));

import AttachmentSection from "./AttachmentSection";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter((child) => child !== null && child !== undefined && child !== false);
};
const walk = (node, visit) => {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
};
const findAll = (root, predicate) => { const found = []; walk(root, (node) => predicate(node) && found.push(node)); return found; };
const text = (node) => typeof node === "string" ? node : childrenOf(node).map(text).join("");
const button = (root, label) => findAll(root, (node) => node.type === "button" && (text(node) === label || node.props?.["aria-label"] === label))[0];
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const createRunner = (props) => ({
  slots: [], effects: [], cursor: 0, tree: null,
  render() { this.cursor = 0; runtime.activate(this); this.tree = AttachmentSection(props); return this.tree; },
  async mount() { this.render(); this.effects.splice(0).forEach((effect) => effect()); await settle(); return this.render(); },
});

const contexts = ["project", "story", "task"];
const propsFor = (entityType) => ({
  projectId: "project-1",
  entityType,
  entityId: entityType === "project" ? "project-1" : `${entityType}-1`,
  userId: "user-1",
});

describe.each(contexts)("AttachmentSection %s load errors", (entityType) => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the error and retries the existing load", async () => {
    service.list.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]);
    const view = createRunner(propsFor(entityType));
    let tree = await view.mount();

    expect(text(findAll(tree, (node) => node.props?.role === "alert")[0])).toContain("Failed to load attachments.");
    expect(button(tree, "Retry")).toBeTruthy();
    expect(button(tree, "Close attachment error")).toBeTruthy();

    button(tree, "Retry").props.onClick();
    tree = view.render();
    expect(text(tree)).toContain("Loading attachments…");
    expect(findAll(tree, (node) => node.props?.role === "alert")).toHaveLength(0);

    await settle();
    tree = view.render();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(findAll(tree, (node) => node.props?.role === "alert")).toHaveLength(0);
  });

  it("closes the message without loading again", async () => {
    service.list.mockRejectedValueOnce(new Error("network"));
    const view = createRunner(propsFor(entityType));
    let tree = await view.mount();

    button(tree, "Close attachment error").props.onClick();
    tree = view.render();

    expect(findAll(tree, (node) => node.props?.role === "alert")).toHaveLength(0);
    expect(service.list).toHaveBeenCalledTimes(1);
  });
});
