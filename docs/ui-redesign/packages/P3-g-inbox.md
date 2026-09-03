# Package P3-g — Inbox page

You own `src/pages/InboxPage.jsx` (+test) and `src/styles/inbox.css`. Nothing else. Do not
delete old files (`src/InboxPage.jsx` is the old one — read it for reference only).

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §4, §6.4 (your deliverable), §11, §12. Then
`src/ui/*`, `src/domain/notificationDomain.js`, `src/app/appRoutes.js` (`projectPath`),
`src/inbox/useNotifications.js` (built by the shell package — you do NOT call it; App does
and passes the results to you).

## Props (exact — App passes these)
```
{ notifications, loading, error, liveNotice, onMarkRead(id) → Promise, onMarkAllRead() → Promise,
  onDismiss(id) → Promise, onRefresh(), onNavigate(path), onOpenSettings() }
```
Each notification: `{ id, type: 'task_assigned'|'comment_added'|'mentioned', readAt,
createdAt, projectId, data: { taskTitle, actorId }, actorName }`.

## Build
Per §6.4: header (title, `Tabs` All/Unread/Mentions with counts, `Mark all read`
secondary (disabled when none unread, busy while pending), `Notification settings` ghost →
`onOpenSettings()`); `.row-list` of `.inbox-item [is-unread]` with icon by type, label via
`notificationLabel`, meta `type · relative-ish time` (use `Intl.DateTimeFormat` short
month/day + time), unread dot, dismiss `IconButton x` (busy per row); click → `onMarkRead`
(if unread) then `onNavigate(projectPath(notification.projectId))` when present.
`liveNotice` → `InlineNotice tone=info`; `error` → `InlineNotice tone=error` with Retry
(`onRefresh`). Empty → `EmptyState icon=inbox`. Filtering via `filterInboxNotifications`.

## Tests
Repo style; assert tab filtering/counts, mark-all disabled state, click marks read and
navigates, dismiss calls, empty/error/live states.

## Verify
`npx vitest run src/pages/InboxPage.test.jsx` passes; `npx oxlint` clean. No build.
