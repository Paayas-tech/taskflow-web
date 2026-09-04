const ALLOWED_DESTINATIONS = new Set(["recover", "confirm", "settings"]);
const CODE_PATTERN = /^[A-Za-z0-9._~-]{20,2048}$/u;

function parseAuthCallback(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "taskflow:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback"
    ) return null;
    if (url.hash || url.username || url.password || url.port) return null;
    if ([...url.searchParams.keys()].some((key) => !["code", "next"].includes(key))) return null;
    const code = url.searchParams.get("code") || "";
    const destination = url.searchParams.get("next") || "confirm";
    if (!CODE_PATTERN.test(code) || !ALLOWED_DESTINATIONS.has(destination)) return null;
    return Object.freeze({ code, destination });
  } catch {
    return null;
  }
}

function findAuthCallback(argumentsList = []) {
  for (const argument of argumentsList) {
    const callback = parseAuthCallback(argument);
    if (callback) return callback;
  }
  return null;
}

function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

module.exports = { findAuthCallback, isAllowedExternalUrl, parseAuthCallback };
