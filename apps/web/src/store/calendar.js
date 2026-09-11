/**
 * Google Calendar events. Fetched the first time the Calendar page opens and
 * re-synced when it is reopened more than `GOOGLE_EVENTS_STALE_MS` later —
 * Google is the source of truth for these, so nothing else tells us they
 * changed. Also replaced from the settings panel after a connect, sync or
 * disconnect.
 */
import {
  api,
  getState,
  isCurrentSession,
  onStoreReset,
  sessionStamp,
  setState,
} from "./store";

export const GOOGLE_EVENTS_STALE_MS = 60_000;

let syncedAt = 0;

onStoreReset(() => {
  syncedAt = 0;
});

const setStatus = (status) =>
  setState((state) => ({ loaded: { ...state.loaded, googleEvents: status } }));

/** Mirrors the connected calendar into the store; no-op when not connected. */
export const loadGoogleEvents = async () => {
  const state = getState();
  if (!state.auth.user) return null;
  const session = sessionStamp();

  const status = state.loaded.googleEvents;
  if (status === "loading") return state.googleEvents;

  const fresh = Date.now() - syncedAt < GOOGLE_EVENTS_STALE_MS;
  if (status === "ready" && fresh) return state.googleEvents;

  // A revalidation keeps the events on screen and stays silent if it fails.
  const revalidating = status === "ready";
  if (!revalidating) setStatus("loading");

  try {
    const connection = await api().getGoogleConnection();
    if (!isCurrentSession(session)) return null;
    if (!connection) {
      setState({ googleEvents: [] });
      syncedAt = Date.now();
      setStatus("ready");
      return [];
    }

    const result = await api().syncGoogleCalendar();
    if (!isCurrentSession(session)) return null;
    const events = Array.isArray(result?.events) ? result.events : [];
    setState({ googleEvents: events });
    syncedAt = Date.now();
    setStatus("ready");
    return events;
  } catch {
    if (!isCurrentSession(session)) return null;
    if (!revalidating) setStatus("error");
    return null;
  }
};

/** Used by the settings panel after connecting, syncing or disconnecting. */
export const setGoogleEvents = (events) => {
  if (!getState().auth.user) return;
  setState({ googleEvents: Array.isArray(events) ? events : [] });
  syncedAt = Date.now();
  setStatus("ready");
};
