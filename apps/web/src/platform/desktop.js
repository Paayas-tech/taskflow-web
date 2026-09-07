const bridge = () => globalThis.window?.taskflowDesktop;

export const isDesktopApp = () => bridge()?.isDesktop === true;

export const recoveryRedirectUrl = (origin = globalThis.window?.location?.origin || "") =>
  isDesktopApp()
    ? "taskflow://auth/callback?next=recover"
    : `${String(origin).replace(/\/$/u, "")}/recover`;

export const openExternalAuthorization = async (url) => {
  if (isDesktopApp()) return bridge().openExternal(url);
  globalThis.window.location.assign(url);
  return true;
};

export const listenForDesktopAuthCallback = (callback) => {
  if (!isDesktopApp() || typeof callback !== "function") return () => {};
  return bridge().onAuthCallback(callback);
};
