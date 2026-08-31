import { createClient } from "npm:@supabase/supabase-js";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"];

export const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

export const jsonResponse = (request: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

export const requiredEnvironment = (name: string) => {
  const value = String(Deno.env.get(name) || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export const adminClient = () =>
  createClient(requiredEnvironment("SUPABASE_URL"), requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

const decodeBase64 = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encryptionKey = async () => {
  const bytes = decodeBase64(requiredEnvironment("GOOGLE_TOKEN_ENCRYPTION_KEY"));
  if (bytes.byteLength !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must contain 32 random bytes");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

export const encryptSecret = async (plaintext: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(plaintext),
  ));
  return `v1.${base64Url(iv)}.${base64Url(encrypted)}`;
};

export const decryptSecret = async (ciphertext: string) => {
  const [version, encodedIv, encodedValue] = ciphertext.split(".");
  if (version !== "v1" || !encodedIv || !encodedValue) throw new Error("Unsupported encrypted value");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(encodedIv) },
    await encryptionKey(),
    decodeBase64(encodedValue),
  );
  return new TextDecoder().decode(decrypted);
};

export const randomUrlSafeValue = (length = 32) =>
  base64Url(crypto.getRandomValues(new Uint8Array(length)));

export const sha256UrlSafe = async (value: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

export const googleTokenRequest = async (values: URLSearchParams) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: values,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    console.error("Google token request failed", response.status, payload.error);
    throw new Error("Google authorization could not be completed");
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
};

export const googleApi = async (url: string, accessToken: string) => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Google Calendar API failed", response.status, payload.error?.status);
    throw new Error("Google Calendar could not be reached");
  }
  return payload;
};

export const appRedirect = (status: string, reason = "") => {
  const destination = new URL("/settings", requiredEnvironment("TASKFLOW_APP_URL"));
  destination.searchParams.set("integration", "google");
  destination.searchParams.set("google_calendar", status);
  if (reason) destination.searchParams.set("reason", reason);
  return Response.redirect(destination.toString(), 302);
};

