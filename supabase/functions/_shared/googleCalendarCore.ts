export const isUsableOAuthState = (storedState: { expires_at?: string } | null, now = Date.now()) => {
  if (!storedState?.expires_at) return false;
  const expiresAt = new Date(storedState.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

export const normalizeGoogleEvent = (
  event: Record<string, any>,
  calendar: Record<string, any>,
) => ({
  id: String(event.id || ""),
  calendarId: String(calendar.id || ""),
  calendarName: String(calendar.summary || calendar.name || calendar.id || "Calendar"),
  title: String(event.summary || "Untitled event"),
  description: String(event.description || ""),
  location: String(event.location || ""),
  start: event.start?.dateTime || event.start?.date || null,
  end: event.end?.dateTime || event.end?.date || null,
  allDay: Boolean(event.start?.date && !event.start?.dateTime),
  status: String(event.status || "confirmed"),
  htmlLink: String(event.htmlLink || ""),
});

export const collectGooglePages = async (
  initialUrl: string,
  fetchPage: (url: string) => Promise<Record<string, any>>,
  maximumPages = 100,
) => {
  const items: Record<string, any>[] = [];
  let pageToken = "";
  let pageCount = 0;
  do {
    const url = new URL(initialUrl);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await fetchPage(url.toString());
    if (Array.isArray(payload.items)) items.push(...payload.items);
    pageToken = String(payload.nextPageToken || "");
    pageCount += 1;
  } while (pageToken && pageCount < maximumPages);
  return items;
};
