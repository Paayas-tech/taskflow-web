# TaskFlow architecture

TaskFlow is a small React 19 + Vite single-page app on Supabase (Postgres with
row-level security, Auth, Storage, Realtime, a few Edge Functions). Everything a
signed-in person can see fits in memory, so the client is built around **one
in-memory store that is loaded once per session and mutated optimistically**.
The server is the source of truth; the store is a write-through cache of it.

```
src/
  main.jsx              boot: configure the store with the api, render <App/>
  App.jsx               auth gate + route switch + shell; no data fetching
  router.js             path helpers (normalizePath, projectPath, routeViewFromPath…)
  api/                  Supabase access. Plain async functions, app-shaped results,
                        no store access, no React. One module per concern.
  store/                the single client store (state + actions + selectors)
  domain/               pure functions: validation, normalization, dates, grouping
  ui/                   presentational primitives (Button, Field, Dialog, Menu, icons…)
  shell/                sidebar, app frame, search dialog, user menu
  tasks/                task row/card/board/panel/composer shared by every surface
  pages/                one component per route
  home/ calendar/ project/ settings/ collaboration/ auth/
                        page-specific pieces, grouped by the page that owns them
  lib/                  browser helpers (localStorage preferences)
  styles/               CSS by concern; tokens.css defines every design token
  test/                 vitest setup, in-memory fake api, render helpers
supabase/               migrations (schema history), RLS tests, edge functions
```

## Data flow

1. `api/auth.onAuthStateChange` → `store/session.startSession(user)`.
2. `startSession` fires every core request **in parallel, once**: projects,
   columns and memberships for all projects, personal tasks, tasks assigned to
   me, my invitations, settings, notifications. Each slice records
   `loaded.<slice>` = `loading | ready | error`.
3. Components read with `useStore(selector)`. Selectors derive views (my tasks,
   a project's tasks and stories, search items…) from the normalized maps and
   are memoized so unchanged inputs return the same reference.
4. Mutations are **store actions** (`store/tasks.js`, `store/projects.js`…):
   validate with a domain function → apply the change to the store immediately →
   call the api in the background → merge the server row on success, restore the
   previous values on failure and surface one notice (`ui.notice`).
   **A mutation never flips a loading flag and never refetches a list.**
5. Project workspaces load lazily: `ensureWorkspace(projectId)` fetches that
   project's tasks and attachment counts the first time it is opened, then
   serves them from the store; a silent background revalidate runs when the
   project is revisited after `WORKSPACE_STALE_MS`.
6. Realtime: notifications, comments and activity subscribe through
   `api/client.subscribeToTable`; changes trigger a silent reload of that slice.

Rules that keep this simple:

- **RLS is the authorization boundary.** The client never pre-checks membership
  before reading; it sends the query and the database returns what is allowed.
- **Migrations define the schema.** Project reads have one narrow compatibility
  fallback for a remote missing migration 017: projects remain usable while
  project health is marked read-only.
- **Ids are minted client-side** (`crypto.randomUUID()`) so an optimistic
  insert and the server row share one id; nothing is remapped later.
- **Loading UI appears only when a slice is `loading` and holds no data.**
  Switching between pages or projects never shows a skeleton for data already in
  the store.
- Row-shaped data lives in `api/`; everything past that boundary is camelCase
  app shape (`rowToTask`, `taskToRow`, `rowToProject`…).

## Store shape

```js
{
  auth: { status: "booting" | "signed-out" | "ready", user: null | User, recovery: false },
  settings: Settings,                         // normalized, always present (defaults until loaded)
  tasks: { [taskId]: Task },                  // personal + assigned + every loaded project's tasks
  projects: { [projectId]: Project },         // includes viewerRole and healthStatus
  columns: { [projectId]: Column[] },
  members: { [projectId]: Member[] },         // Member = { userId, role, displayName, avatarUrl }
  profiles: { [userId]: { displayName, avatarUrl } },
  invitations: Invitation[],                  // pending invitations addressed to me
  notifications: Notification[],
  attachmentCounts: { [taskId]: number },
  googleEvents: GoogleEvent[],
  loaded: { tasks, projects, invitations, settings, notifications: Status,
            workspaces: { [projectId]: Status }, googleEvents: Status },   // Status = "idle"|"loading"|"ready"|"error"
  errors: { tasks, projects, invitations, settings, notifications: "", workspaces: { [projectId]: "" } },
  pending: { [taskId]: number },              // in-flight mutations per task (rows show a busy state)
  workspaceLoadedAt: { [projectId]: ms },     // freshness stamps for the silent revalidations
  lastCoreLoadAt: ms,
  ui: { path, selectedTaskId, composer, searchOpen, sidebarCollapsed, mobileNavOpen,
        notice, reminderNotice, projectOpenRequest, projectCreateRequest,
        profileSettingsRequest, profilePromptDismissed },
}
```

Store actions never throw. They resolve to a result (`createTask → Task | null`,
`toggleComplete → boolean`, `bulkUpdate → { updated, failed, failedIds }`…) and put any
failure message in `ui.notice`, which the shell renders once as a transient toast. Pages
therefore have no try/catch or error state of their own around mutations.

`Task` is the app shape used everywhere: `id, projectId, workType ("task"|"story"),
storyId, title, description, notes, status ("todo"|"in-progress"|"completed"),
completed, priority, dueDate, endDate, startTime, endTime, reminder, reminderAt,
columnId, position, assigneeId, archivedAt, completedAt, createdAt, updatedAt`.
Selectors enrich tasks with `projectName`, `assigneeName`, `storyName` and
`attachmentCount` from the other maps; components never look those up themselves.

## Testing

- `vitest` with `jsdom` and `@testing-library/react`. Components are rendered for
  real; tests interact through roles and text, never through element props.
- `src/test/fakeApi.js` is an in-memory implementation of the `api/` contract.
  Store tests drive actions against it (including `failNext` for rollbacks);
  page tests render against a store seeded through it. No test mocks React.
- **The suite never reaches Supabase and never reads the developer's `.env`.**
  `test.env` in `vite.config.js` pins placeholder credentials, so `api/client.js`
  resolves the same way on every machine; `App.test.jsx` mocks `api/client`
  outright and flips `isSupabaseConfigured` itself to cover both sides of the
  configuration gate.
- `src/test/setup.js` cancels the store's module-level timers after every test —
  the debounced last-viewed write and the notice timeout, both of which
  `endSession` cancels in the app — so one test's pending write can never land on
  the next test's fake api (`src/test/isolation.test.js`).
- `domain/` functions are tested directly and table-driven.
- Database policies are tested in `supabase/tests` (`npm run test:db`).
