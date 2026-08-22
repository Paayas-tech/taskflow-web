import { useCallback, useEffect, useRef } from "react";

const modalStack = [];
let bodyLockCount = 0;
let previousBodyOverflow;

const focusableSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]",
  "[contenteditable='true']",
].join(",");

function isConnected(element) {
  return Boolean(element && element.isConnected !== false);
}

function isHidden(element) {
  if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") {
    return true;
  }

  if (element.closest?.("[hidden], [aria-hidden='true']")) {
    return true;
  }

  const style = globalThis.getComputedStyle?.(element);
  return style?.display === "none" || style?.visibility === "hidden";
}

function isFocusable(element) {
  if (!isConnected(element) || element.disabled || isHidden(element)) {
    return false;
  }

  const tabIndex = Number(element.getAttribute?.("tabindex") ?? element.tabIndex);
  return Number.isFinite(tabIndex) && tabIndex >= 0;
}

function canReceiveProgrammaticFocus(element) {
  return Boolean(
    isConnected(element) &&
      !element.disabled &&
      !isHidden(element) &&
      (isFocusable(element) || element.getAttribute?.("tabindex") !== null)
  );
}

function focusElement(element) {
  if (!canReceiveProgrammaticFocus(element)) {
    return false;
  }

  element.focus?.({ preventScroll: true });
  return true;
}

function focusableChildren(container) {
  if (!container?.querySelectorAll) {
    return [];
  }

  return Array.from(container.querySelectorAll(focusableSelector)).filter(
    isFocusable
  );
}

function acquireBodyLock() {
  if (typeof document === "undefined") {
    return;
  }

  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyLockCount += 1;
}

function releaseBodyLock() {
  if (typeof document === "undefined" || bodyLockCount === 0) {
    return;
  }

  bodyLockCount -= 1;
  if (bodyLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? "";
    previousBodyOverflow = undefined;
  }
}

function isTopModal(token) {
  return modalStack.at(-1) === token;
}

/**
 * Provides opt-in modal lifecycle behavior without imposing modal markup.
 *
 * @param {object} options
 * @param {boolean} options.isOpen Whether the modal is currently open.
 * @param {{ current: HTMLElement | null }} options.modalRef Stable modal container ref.
 * @param {() => void} options.onClose Close callback.
 * @param {{ current: HTMLElement | null }} [options.triggerRef] Optional opener ref.
 * @param {{ current: HTMLElement | null }} [options.initialFocusRef] Optional initial target.
 * @param {boolean} [options.isDismissDisabled=false] Prevents dismissal while busy.
 * @param {boolean} [options.allowEscape=true] Enables Escape dismissal.
 * @param {boolean} [options.allowBackdropDismiss=true] Enables backdrop dismissal.
 * @param {boolean} [options.restoreFocus=true] Restores focus to the opener on cleanup.
 * @param {boolean} [options.lockBodyScroll=true] Locks body scrolling while open.
 * @returns {{ onBackdropMouseDown: (event: MouseEvent) => void }} Optional backdrop handler.
 */
export function useModalLifecycle({
  isOpen,
  modalRef,
  onClose,
  triggerRef,
  initialFocusRef,
  isDismissDisabled = false,
  allowEscape = true,
  allowBackdropDismiss = true,
  restoreFocus = true,
  lockBodyScroll = true,
}) {
  const tokenRef = useRef(Symbol("modal"));
  const optionsRef = useRef({});
  optionsRef.current = {
    isOpen,
    onClose,
    isDismissDisabled,
    allowEscape,
    allowBackdropDismiss,
    restoreFocus,
  };

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    const token = tokenRef.current;
    const triggerElement = triggerRef?.current;
    modalStack.push(token);
    if (lockBodyScroll) {
      acquireBodyLock();
    }

    if (!focusElement(initialFocusRef?.current)) {
      focusElement(modalRef?.current);
    }

    return () => {
      const ownedTopPosition = modalStack.lastIndexOf(token);
      const wasTopModal = ownedTopPosition === modalStack.length - 1;
      if (ownedTopPosition >= 0) {
        modalStack.splice(ownedTopPosition, 1);
      }
      if (lockBodyScroll) {
        releaseBodyLock();
      }

      if (wasTopModal && optionsRef.current.restoreFocus) {
        focusElement(triggerElement);
      }
    };
  }, [isOpen, modalRef, initialFocusRef, triggerRef, lockBodyScroll]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (!isTopModal(tokenRef.current)) {
        return;
      }

      const options = optionsRef.current;
      if (event.key === "Escape") {
        if (options.allowEscape && !options.isDismissDisabled) {
          event.preventDefault();
          options.onClose?.();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = modalRef?.current;
      if (!container) {
        return;
      }

      const elements = focusableChildren(container);
      if (elements.length === 0) {
        if (focusElement(container)) {
          event.preventDefault();
        }
        return;
      }

      const first = elements[0];
      const last = elements.at(-1);
      const activeElement = document.activeElement;

      if (elements.length === 1) {
        event.preventDefault();
        focusElement(first);
      } else if (
        event.shiftKey &&
        (activeElement === first ||
          activeElement === container ||
          !container.contains(activeElement))
      ) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && (activeElement === last || !container.contains(activeElement))) {
        event.preventDefault();
        focusElement(first);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, modalRef]);

  const onBackdropMouseDown = useCallback(
    (event) => {
      const options = optionsRef.current;
      if (
        event.target === event.currentTarget &&
        options.isOpen &&
        options.allowBackdropDismiss &&
        !options.isDismissDisabled &&
        isTopModal(tokenRef.current)
      ) {
        options.onClose?.();
      }
    },
    []
  );

  return { onBackdropMouseDown };
}

export default useModalLifecycle;
