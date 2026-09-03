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
vi.mock("../application/attachmentService", () => ({ attachmentService: service }));

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
const notice = (root, tone) => findAll(root, (node) => node.props?.tone === tone)[0];
const button = (root, label) => findAll(root, (node) => text(node) === label || node.props?.label === label)[0];
const menuItems = (root) => findAll(root, (node) => Array.isArray(node.props?.items))[0]?.props.items ?? [];
const dialog = (root) => findAll(root, (node) => typeof node.props?.confirmLabel === "string")[0];
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

    const failure = notice(tree, "error");
    expect(text(failure)).toContain("Failed to load attachments.");
    expect(text(failure.props.action)).toBe("Retry");
    expect(failure.props.onDismiss).toBeTypeOf("function");

    failure.props.action.props.onClick();
    tree = view.render();
    expect(text(tree)).toContain("Loading attachments…");
    expect(notice(tree, "error")).toBeUndefined();

    await settle();
    tree = view.render();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(notice(tree, "error")).toBeUndefined();
  });

  it("closes the message without loading again", async () => {
    service.list.mockRejectedValueOnce(new Error("network"));
    const view = createRunner(propsFor(entityType));
    let tree = await view.mount();

    notice(tree, "error").props.onDismiss();
    tree = view.render();

    expect(notice(tree, "error")).toBeUndefined();
    expect(service.list).toHaveBeenCalledTimes(1);
  });
});

describe("AttachmentSection immediate persistence feedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports that a successful upload is saved automatically", async () => {
    const onMutation = vi.fn();
    const file = { name: "brief.pdf", size: 128, type: "application/pdf" };
    service.list.mockResolvedValue([]);
    service.upload.mockResolvedValue({ id: "attachment-1", fileName: file.name, sizeBytes: file.size });
    const view = createRunner({ ...propsFor("task"), canManage: true, onMutation });
    let tree = await view.mount();
    const input = findAll(tree, (node) => node.type === "input" && node.props?.type === "file")[0];

    expect(button(tree, "Upload")).toBeTruthy();
    input.props.onChange({ target: { files: [file] } });
    await settle();
    tree = view.render();

    expect(service.upload).toHaveBeenCalled();
    expect(onMutation).toHaveBeenCalledWith("upload", expect.objectContaining({ id: "attachment-1" }));
    expect(text(tree)).toContain("saved automatically");
  });
});

describe("AttachmentSection row actions", () => {
  beforeEach(() => vi.clearAllMocks());

  const attachment = {
    id: "attachment-1",
    fileName: "brief.pdf",
    sizeBytes: 2048,
    uploaderName: "Priya Shah",
    createdAt: new Date().toISOString(),
  };

  it("lists the file with its size, uploader and date", async () => {
    service.list.mockResolvedValue([attachment]);
    const view = createRunner(propsFor("task"));
    const tree = await view.mount();

    expect(text(tree)).toContain("brief.pdf");
    expect(text(tree)).toContain("2 KB · Priya Shah · Today");
    expect(menuItems(tree).map((item) => item.label)).toEqual(["Download"]);
  });

  it("deletes through the menu only after the confirmation dialog", async () => {
    service.list.mockResolvedValue([attachment]);
    service.remove.mockResolvedValue(undefined);
    const onMutation = vi.fn();
    const view = createRunner({ ...propsFor("task"), canManage: true, onMutation });
    let tree = await view.mount();

    const remove = menuItems(tree).find((item) => item.id === "delete");
    expect(remove.danger).toBe(true);
    expect(dialog(tree).props.open).toBe(false);

    remove.onSelect();
    tree = view.render();
    const confirm = dialog(tree);
    expect(confirm.props.open).toBe(true);
    expect(confirm.props.confirmLabel).toBe("Delete");
    expect(confirm.props.danger).toBe(true);
    expect(service.remove).not.toHaveBeenCalled();

    confirm.props.onConfirm();
    await settle();
    tree = view.render();

    expect(service.remove).toHaveBeenCalledWith(attachment);
    expect(onMutation).toHaveBeenCalledWith("delete", attachment);
    expect(dialog(tree).props.open).toBe(false);
  });

  it("offers a drop zone only when dropping is allowed and managed", async () => {
    service.list.mockResolvedValue([]);
    const readOnly = createRunner({ ...propsFor("task"), allowDrop: true });
    expect(text(await readOnly.mount())).not.toContain("Drop a file here");

    const manager = createRunner({ ...propsFor("task"), allowDrop: true, canManage: true });
    const tree = await manager.mount();
    expect(findAll(tree, (node) => node.props?.className === "attachment-dropzone")).toHaveLength(1);
    expect(tree.props.onDrop).toBeTypeOf("function");
  });

  it("uses one compact empty drop target instead of a second empty state", async () => {
    service.list.mockResolvedValue([]);
    const view = createRunner({
      ...propsFor("task"),
      allowDrop: true,
      canManage: true,
      compact: true,
    });
    const tree = await view.mount();

    expect(text(tree)).toContain("Attachments");
    expect(text(tree)).toContain("Drop a file here · 10 MB max");
    expect(text(tree)).not.toContain("No attachments");
  });
});
