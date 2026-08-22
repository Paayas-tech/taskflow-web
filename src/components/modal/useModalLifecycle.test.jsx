import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let activeRunner;

  function sameDependencies(previous, next) {
    return Boolean(
      previous &&
        next &&
        previous.length === next.length &&
        previous.every((value, index) => Object.is(value, next[index]))
    );
  }

  return {
    setActiveRunner(runner) {
      activeRunner = runner;
    },
    useRef(initialValue) {
      const index = activeRunner.cursor++;
      activeRunner.slots[index] ??= { current: initialValue };
      return activeRunner.slots[index];
    },
    useEffect(effect, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
        activeRunner.pending.push({ index, effect, dependencies });
      }
    },
    useCallback(callback, dependencies) {
      const index = activeRunner.cursor++;
      const previous = activeRunner.slots[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) {
        return previous.callback;
      }
      activeRunner.slots[index] = { callback, dependencies };
      return callback;
    },
  };
});

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
}));

import { useModalLifecycle } from "./useModalLifecycle";

const mountedRunners = new Set();

function createHookRunner(Harness, initialProps) {
  const runner = { cursor: 0, pending: [], slots: [], output: undefined };

  function render(props = initialProps) {
    runner.cursor = 0;
    runner.pending = [];
    hookRuntime.setActiveRunner(runner);
    runner.output = Harness(props);

    for (const pendingEffect of runner.pending) {
      runner.slots[pendingEffect.index]?.cleanup?.();
      runner.slots[pendingEffect.index] = {
        dependencies: pendingEffect.dependencies,
        cleanup: pendingEffect.effect(),
      };
    }
    return runner.output;
  }

  function unmount() {
    for (const slot of [...runner.slots].reverse()) {
      slot?.cleanup?.();
    }
    runner.slots = [];
    mountedRunners.delete(api);
  }

  const api = {
    render,
    unmount,
    get output() {
      return runner.output;
    },
  };
  mountedRunners.add(api);
  render(initialProps);
  return api;
}

function HookHarness(props) {
  return useModalLifecycle(props);
}

function createElement({
  tabIndex = -1,
  disabled = false,
  hidden = false,
  ariaHidden = false,
  connected = true,
  children = [],
} = {}) {
  const attributes = new Map();
  if (tabIndex >= 0) attributes.set("tabindex", String(tabIndex));
  if (ariaHidden) attributes.set("aria-hidden", "true");

  const element = {
    disabled,
    hidden,
    isConnected: connected,
    tabIndex,
    children,
    focus: vi.fn(() => {
      document.activeElement = element;
    }),
    getAttribute: (name) => attributes.get(name) ?? null,
    closest: (selector) =>
      (hidden && selector.includes("[hidden]")) ||
      (ariaHidden && selector.includes("aria-hidden"))
        ? element
        : null,
    contains: (candidate) => candidate === element || children.includes(candidate),
    querySelectorAll: () => children,
  };
  return element;
}

function createDocument() {
  const listeners = new Map();
  return {
    activeElement: null,
    body: { style: { overflow: "" } },
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? new Set();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

function keyEvent(key, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() };
}

function defaultProps(overrides = {}) {
  return {
    isOpen: true,
    modalRef: { current: createElement({ tabIndex: 0 }) },
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
});

afterEach(() => {
  for (const runner of [...mountedRunners]) runner.unmount();
  delete globalThis.document;
  delete globalThis.getComputedStyle;
});

describe("useModalLifecycle", () => {
  it("does nothing while closed", () => {
    const modal = createElement({ tabIndex: 0 });
    const onClose = vi.fn();
    createHookRunner(HookHarness, defaultProps({ isOpen: false, modalRef: { current: modal }, onClose }));

    const tab = keyEvent("Tab");
    document.dispatch("keydown", tab);
    document.dispatch("keydown", keyEvent("Escape"));

    expect(document.body.style.overflow).toBe("");
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(modal.focus).not.toHaveBeenCalled();
  });

  it("restores a pre-existing body overflow value after close", () => {
    document.body.style.overflow = "clip";
    const props = defaultProps();
    const runner = createHookRunner(HookHarness, props);
    expect(document.body.style.overflow).toBe("hidden");

    runner.render({ ...props, isOpen: false });
    expect(document.body.style.overflow).toBe("clip");
  });

  it("restores body overflow when unmounted while open", () => {
    document.body.style.overflow = "scroll";
    const runner = createHookRunner(HookHarness, defaultProps());
    runner.unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("keeps scrolling locked until two open hooks release their locks", () => {
    const first = createHookRunner(HookHarness, defaultProps());
    const second = createHookRunner(HookHarness, defaultProps());

    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("leaves body scrolling unchanged when locking is disabled", () => {
    document.body.style.overflow = "auto";
    const runner = createHookRunner(
      HookHarness,
      defaultProps({ lockBodyScroll: false })
    );
    expect(document.body.style.overflow).toBe("auto");
    runner.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes exactly once for Escape when enabled and not busy", () => {
    const onClose = vi.fn();
    createHookRunner(HookHarness, defaultProps({ onClose }));
    const event = keyEvent("Escape");
    document.dispatch("keydown", event);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Escape is disabled", { allowEscape: false }, "Escape"],
    ["dismissal is busy", { isDismissDisabled: true }, "Escape"],
    ["another key is pressed", {}, "Enter"],
  ])("does not close when %s", (_name, overrides, key) => {
    const onClose = vi.fn();
    createHookRunner(HookHarness, defaultProps({ ...overrides, onClose }));
    document.dispatch("keydown", keyEvent(key));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses the requested initial element", () => {
    const initial = createElement({ tabIndex: 0 });
    const modal = createElement({ tabIndex: 0 });
    createHookRunner(
      HookHarness,
      defaultProps({ modalRef: { current: modal }, initialFocusRef: { current: initial } })
    );

    expect(initial.focus).toHaveBeenCalledTimes(1);
    expect(modal.focus).not.toHaveBeenCalled();
  });

  it("falls back safely to the modal container for unavailable initial refs", () => {
    const modal = createElement({ tabIndex: 0 });
    expect(() =>
      createHookRunner(
        HookHarness,
        defaultProps({ modalRef: { current: modal }, initialFocusRef: { current: null } })
      )
    ).not.toThrow();
    expect(modal.focus).toHaveBeenCalledTimes(1);
  });

  it("can programmatically focus a modal container with tabindex minus one", () => {
    const modal = createElement();
    modal.getAttribute = (name) => (name === "tabindex" ? "-1" : null);
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    expect(modal.focus).toHaveBeenCalledTimes(1);
  });

  it("cycles Tab from the last child to the first", () => {
    const first = createElement({ tabIndex: 0 });
    const last = createElement({ tabIndex: 0 });
    const modal = createElement({ tabIndex: 0, children: [first, last] });
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    document.activeElement = last;

    const event = keyEvent("Tab");
    document.dispatch("keydown", event);
    expect(document.activeElement).toBe(first);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("cycles Shift+Tab from the first child to the last", () => {
    const first = createElement({ tabIndex: 0 });
    const last = createElement({ tabIndex: 0 });
    const modal = createElement({ tabIndex: 0, children: [first, last] });
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    document.activeElement = first;

    document.dispatch("keydown", keyEvent("Tab", true));
    expect(document.activeElement).toBe(last);
  });

  it("cycles Shift+Tab from the modal container to the last child", () => {
    const first = createElement({ tabIndex: 0 });
    const last = createElement({ tabIndex: 0 });
    const modal = createElement({ tabIndex: 0, children: [first, last] });
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    document.activeElement = modal;

    document.dispatch("keydown", keyEvent("Tab", true));
    expect(document.activeElement).toBe(last);
  });

  it("keeps focus on a single focusable child", () => {
    const only = createElement({ tabIndex: 0 });
    const modal = createElement({ tabIndex: 0, children: [only] });
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    document.activeElement = only;

    document.dispatch("keydown", keyEvent("Tab", true));
    expect(document.activeElement).toBe(only);
    expect(only.focus).toHaveBeenCalled();
  });

  it("keeps focus on the container when no eligible child exists", () => {
    const hidden = createElement({ tabIndex: 0, hidden: true });
    const modal = createElement({ tabIndex: 0, children: [hidden] });
    createHookRunner(HookHarness, defaultProps({ modalRef: { current: modal } }));
    modal.focus.mockClear();

    document.dispatch("keydown", keyEvent("Tab"));
    expect(document.activeElement).toBe(modal);
  });

  it("restores focus to a connected opener after close", () => {
    const opener = createElement({ tabIndex: 0 });
    const props = defaultProps({ triggerRef: { current: opener } });
    const runner = createHookRunner(HookHarness, props);

    runner.render({ ...props, isOpen: false });
    expect(opener.focus).toHaveBeenCalledTimes(1);
  });

  it("does not throw for a removed opener or restore when disabled", () => {
    const removed = createElement({ tabIndex: 0, connected: false });
    const removedProps = defaultProps({ triggerRef: { current: removed } });
    const removedRunner = createHookRunner(HookHarness, removedProps);
    expect(() => removedRunner.render({ ...removedProps, isOpen: false })).not.toThrow();
    expect(removed.focus).not.toHaveBeenCalled();

    const opener = createElement({ tabIndex: 0 });
    const disabledProps = defaultProps({ triggerRef: { current: opener }, restoreFocus: false });
    const disabledRunner = createHookRunner(HookHarness, disabledProps);
    disabledRunner.render({ ...disabledProps, isOpen: false });
    expect(opener.focus).not.toHaveBeenCalled();
  });

  it("does not restore a lower modal opener while another modal owns focus", () => {
    const lowerOpener = createElement({ tabIndex: 0 });
    const lower = createHookRunner(HookHarness, defaultProps({ triggerRef: { current: lowerOpener } }));
    const upper = createHookRunner(HookHarness, defaultProps());

    lower.unmount();
    expect(lowerOpener.focus).not.toHaveBeenCalled();
    upper.unmount();
  });

  it("dismisses only direct, enabled backdrop interactions", () => {
    const onClose = vi.fn();
    const runner = createHookRunner(HookHarness, defaultProps({ onClose }));
    const backdrop = {};
    const content = {};

    runner.output.onBackdropMouseDown({ target: content, currentTarget: backdrop });
    expect(onClose).not.toHaveBeenCalled();
    runner.output.onBackdropMouseDown({ target: backdrop, currentTarget: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["disabled", { allowBackdropDismiss: false }],
    ["busy", { isDismissDisabled: true }],
    ["closed", { isOpen: false }],
  ])("does not dismiss the backdrop when %s", (_name, overrides) => {
    const onClose = vi.fn();
    const runner = createHookRunner(HookHarness, defaultProps({ ...overrides, onClose }));
    const backdrop = {};
    runner.output.onBackdropMouseDown({ target: backdrop, currentTarget: backdrop });
    expect(onClose).not.toHaveBeenCalled();
  });
});
