import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as api from "./api";
import { App } from "./App.jsx";
import { handleAuthEvent, revalidate } from "./store/session";
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "./store/reminders";
import { configureStore, subscribe } from "./store/store";
import { syncPathFromBrowser } from "./store/ui";
import { listenForDesktopAuthCallback } from "./platform/desktop";
import "./styles/index.css";

configureStore({ api });

// Supabase drives the session: the first event (with or without a user) takes
// the store out of its booting state.
if (api.isApiConfigured) {
  api.onAuthStateChange((event, user) => {
    void handleAuthEvent(event, user);
  });

  listenForDesktopAuthCallback(async ({ code, destination }) => {
    try {
      const result = await api.exchangeDesktopAuthCode(code);
      await handleAuthEvent(
        destination === "recover" ? "PASSWORD_RECOVERY" : "SIGNED_IN",
        result.user
      );
    } catch {
      // Invalid, expired, or replayed codes do not change the current session.
    }
  });
}

window.addEventListener("popstate", syncPathFromBrowser);

// Coming back to the tab silently refreshes anything that went stale.
const revalidateSession = () => {
  void revalidate();
};
window.addEventListener("focus", revalidateSession);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") revalidateSession();
});

// Reminders run for exactly as long as somebody is signed in.
let sessionActive = false;
subscribe((state) => {
  const active = Boolean(state.auth.user);
  if (active === sessionActive) return;
  sessionActive = active;
  if (active) startReminderScheduler();
  else stopReminderScheduler();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
