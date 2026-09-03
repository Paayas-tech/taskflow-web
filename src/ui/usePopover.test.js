import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [], setters: [] }));

vi.mock("react", () => ({
  useState: (initial) => {
    const setter = vi.fn();
    hooks.setters.push(setter);
    return [initial, setter];
  },
  useRef: (initial) => ({ current: initial }),
  useCallback: (callback) => callback,
  useEffect: (effect) => {
    hooks.effects.push(effect);
  },
}));

import { usePopover } from "./usePopover";

const documentStub = () => {
  const listeners = {};
  return {
    listeners,
    addEventListener: vi.fn((type, handler) => {
      listeners[type] = handler;
    }),
    removeEventListener: vi.fn(),
  };
};

const runLastEffect = () => hooks.effects.at(-1)();

afterEach(() => {
  hooks.effects.length = 0;
  hooks.setters.length = 0;
  delete globalThis.document;
});

describe("usePopover", () => {
  it("starts closed and exposes toggle and close", () => {
    const popover = usePopover();
    const setOpen = hooks.setters.at(-1);

    expect(popover.open).toBe(false);
    expect(popover.rootRef.current).toBeNull();

    popover.toggle();
    expect(setOpen.mock.calls[0][0](false)).toBe(true);

    popover.close();
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("registers no listeners while closed", () => {
    globalThis.document = documentStub();
    usePopover();

    expect(runLastEffect()).toBeUndefined();
    expect(globalThis.document.addEventListener).not.toHaveBeenCalled();
  });

  it("closes on outside mousedown and on Escape, then cleans up", () => {
    const stub = documentStub();
    globalThis.document = stub;
    const popover = usePopover(true);
    const setOpen = hooks.setters.at(-1);
    popover.rootRef.current = { contains: (target) => target === "inside" };

    const cleanup = runLastEffect();

    stub.listeners.mousedown({ target: "inside" });
    expect(setOpen).not.toHaveBeenCalled();

    stub.listeners.mousedown({ target: "outside" });
    expect(setOpen).toHaveBeenCalledWith(false);

    stub.listeners.keydown({ key: "a" });
    expect(setOpen).toHaveBeenCalledTimes(1);

    stub.listeners.keydown({ key: "Escape" });
    expect(setOpen).toHaveBeenCalledTimes(2);

    cleanup();
    expect(stub.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
