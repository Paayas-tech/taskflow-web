const test = require("node:test");
const assert = require("node:assert/strict");
const { findAuthCallback, isAllowedExternalUrl, parseAuthCallback } = require("./deep-link.cjs");
const code = "abcdefghijklmnopqrstuvwxyz0123456789";

test("accepts and sanitizes a strict PKCE callback", () => {
  assert.deepEqual(parseAuthCallback(`taskflow://auth/callback?code=${code}&next=recover`), { code, destination: "recover" });
});

test("finds a callback in command-line arguments", () => {
  assert.equal(findAuthCallback(["TaskFlow.exe", `taskflow://auth/callback?code=${code}&next=confirm`])?.destination, "confirm");
});

test("rejects unrecognized callback shapes", () => {
  [
    `https://auth/callback?code=${code}&next=recover`,
    `taskflow://evil/callback?code=${code}&next=recover`,
    `taskflow://auth/other?code=${code}&next=recover`,
    `taskflow://auth/callback?code=short&next=recover`,
    `taskflow://auth/callback?code=${code}&next=admin`,
    `taskflow://auth/callback?code=${code}&next=recover&extra=value`,
    `taskflow://auth/callback?code=${code}&next=recover#access_token=secret`,
  ].forEach((value) => assert.equal(parseAuthCallback(value), null));
});

test("allows credential-free HTTPS URLs only", () => {
  assert.equal(isAllowedExternalUrl("https://accounts.google.com/o/oauth2/v2/auth"), true);
  assert.equal(isAllowedExternalUrl("http://accounts.google.com/"), false);
  assert.equal(isAllowedExternalUrl("https://user:pass@example.com/"), false);
  assert.equal(isAllowedExternalUrl("file:///tmp/example"), false);
});
