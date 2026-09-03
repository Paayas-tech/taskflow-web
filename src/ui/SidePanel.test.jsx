import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] }));

vi.mock("react", () => ({
  useRef: (initial) => ({ current: initial }),
  useEffect: (effect) => {
    hooks.effects.push(effect);
  },
}));

import { SidePanel } from "./SidePanel";
import { find, textContent } from "../test/elementTree";

const documentStub = (dialogOpen = false) => {
  const listeners = {};
  return {
    listeners,
    addEventListener: vi.fn((type, handler) => {
      listeners[type] = handler;
    }),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(() => (dialogOpen ? { className: "dialog" } : null)),
  };
};

afterEach(() => {
  hooks.effects.length = 0;
  vi.clearAllMocks();
  delete globalThis.document;
});

describe("SidePanel", () => {
  it("renders nothing while closed", () => {
    expect(SidePanel({ open: false, ariaLabel: "Task details" })).toBeNull();
  });

  it("renders header, body and footer regions", () => {
    const output = SidePanel({
      open: true,
      ariaLabel: "Task details",
      header: "Review release",
      footer: "footer",
      width: 520,
      children: "body",
    });

    expect(output.type).toBe("aside");
    expect(output.props.role).toBe("complementary");
    expect(output.props["aria-label"]).toBe("Task details");
    expect(output.props.style).toEqual({ width: 520 });
    expect(textContent(find(output, (node) => node.props.className === "side-panel-header"))).toBe("Review release");
    expect(textContent(find(output, (node) => node.props.className === "side-panel-body"))).toBe("body");
  });

  it("closes on Escape when no dialog is open", () => {
    const stub = documentStub(false);
    globalThis.document = stub;
    const onClose = vi.fn();
    SidePanel({ open: true, onClose, children: null });
    const cleanup = hooks.effects.at(-1)();

    stub.listeners.keydown({ key: "Escape", preventDefault: vi.fn() });
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanup();
    expect(stub.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to the dialog above it", () => {
    const stub = documentStub(true);
    globalThis.document = stub;
    const onClose = vi.fn();
    SidePanel({ open: true, onClose, children: null });
    hooks.effects.at(-1)();

    stub.listeners.keydown({ key: "Escape", preventDefault: vi.fn() });
    expect(stub.querySelector).toHaveBeenCalledWith(".dialog");
    expect(onClose).not.toHaveBeenCalled();
  });
});
