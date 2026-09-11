import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { cancelRememberLastViewed } from "../store/settings";
import { clearNotice } from "../store/ui";

afterEach(() => {
  cleanup();
  // Two store actions arm a module-level timer that outlives the test that
  // started it: the debounced `saveSettings` behind `navigate`, and the notice
  // that clears itself after six seconds. In the app `endSession` cancels both;
  // here every test ends the session, so drop them the same way. Otherwise a
  // pending write lands on the *next* test's fake api.
  cancelRememberLastViewed();
  clearNotice();
});

// Node defines its own experimental `localStorage` global, which resolves to
// undefined without `--localstorage-file` and shadows the working jsdom
// implementation. Point the two storage globals back at jsdom's.
for (const name of ["localStorage", "sessionStorage"]) {
  if (typeof window !== "undefined" && !window[name] && window[`_${name}`]) {
    Object.defineProperty(window, name, {
      configurable: true,
      get: () => window[`_${name}`],
    });
  }
}

// jsdom has no media query engine. Report "light" and accept listeners so the
// theme effect runs exactly as it does in a browser.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    media: String(query || ""),
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

// jsdom does not implement the native <dialog> modal API. Toggle the `open`
// attribute and fire the events the real element fires so components built on
// showModal()/close() behave the same way under test.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(returnValue) {
    if (typeof returnValue === "string") {
      this.returnValue = returnValue;
    }
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
