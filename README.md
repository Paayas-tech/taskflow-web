# TaskFlow

TaskFlow is a collaborative productivity application built with React, Vite,
and Supabase. It supports personal tasks, project workspaces, Kanban, calendar
views, invitations, member roles, assignees, comments, activity, attachments,
and realtime notifications.

## Routes

The app is a single-page application with a sidebar shell and no top bar. Every
route below renders inside `src/App.jsx`; unknown paths normalize to `/`.

| Route | Page |
|---|---|
| `/` | Home dashboard (`src/pages/HomePage.jsx`) |
| `/tasks` | My Tasks, list or board (`src/pages/MyTasksPage.jsx`) |
| `/calendar` | Month / Week / Day / Agenda (`src/pages/CalendarPage.jsx`) |
| `/inbox` | Notifications (`src/pages/InboxPage.jsx`) |
| `/projects` | Project list and invitations (`src/pages/ProjectsPage.jsx`) |
| `/projects/:id/{overview,board,list,stories}` | Project workspace (`src/pages/ProjectWorkspacePage.jsx`) |
| `/settings` | Settings (`src/SettingsPage.jsx`) |
| `/archived-tasks` | Archived personal tasks (`src/pages/ArchivedTasksPage.jsx`) |
| `/recover` | Password recovery (`src/auth/Recover.jsx`) |

`/projects/:id` and any unknown project sub-path redirect to
`/projects/:id/overview`. In development, `/__preview` renders the offline
component harness in `src/dev/`; it is excluded from production builds.

## Requirements

- Node.js 20 or newer
- npm
- Supabase CLI
- Docker Desktop for local database and RLS tests

## Environment

Copy `.env.example` to `.env` and provide the browser-safe values from the
Supabase project API settings:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never expose a Supabase service-role or secret key through a `VITE_` variable.
All authorization is enforced by PostgreSQL Row Level Security.

Calendar provider connections can optionally be configured at deployment time
through Supabase Edge Functions. Provider client secrets, encryption keys,
tokens, and app-specific passwords must never be added to browser environment
variables.

### Google Calendar integration

Google Calendar is the first supported provider. Enable the Google Calendar API
in Google Cloud, configure the OAuth consent screen, and create an OAuth 2.0 Web
application. Add this exact authorized redirect URI:

```text
https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth-callback
```

For the currently linked TaskFlow project, the production callback is:

```text
https://ousvpcgheqtwrnhfhkve.supabase.co/functions/v1/google-calendar-oauth-callback
```

Generate a base64url-encoded 32-byte encryption key and set these Supabase Edge
Function secrets (never prefix them with `VITE_`):

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
TASKFLOW_APP_URL
```

`GOOGLE_REDIRECT_URI` must exactly match the Google Cloud redirect URI above.
`TASKFLOW_APP_URL` is the deployed TaskFlow origin, for example
`https://taskflow.example.com`. Apply migration 014, then deploy:

```bash
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=... GOOGLE_TOKEN_ENCRYPTION_KEY=... TASKFLOW_APP_URL=...
npx supabase functions deploy google-calendar-oauth-start
npx supabase functions deploy google-calendar-oauth-callback --no-verify-jwt
npx supabase functions deploy google-calendar-sync
npx supabase functions deploy google-calendar-disconnect
```

For local Supabase development, add
`http://127.0.0.1:54321/functions/v1/google-calendar-oauth-callback` as a
separate authorized redirect URI and set `TASKFLOW_APP_URL` to
`http://localhost:5173`. Keep local function secrets in an ignored Supabase env
file; never put the client secret or encryption key in a `VITE_` variable.

While the Google OAuth consent screen remains in Testing status, add each person
who will connect a calendar as a test user. TaskFlow requests `openid`, `email`,
and `https://www.googleapis.com/auth/calendar.readonly` only.

Only connection metadata is readable by the signed-in browser. OAuth state,
encrypted access tokens, and encrypted refresh tokens remain in the private
schema and are available only through service-role-only database functions.

## Local development

```bash
npm install
npx supabase start
npx supabase db reset --local
npm run dev
```

The application uses the Supabase URL and anon key from `.env`. Database schema
and policy history is defined by the ordered, data-free files in
`supabase/migrations/`. A local `supabase db reset` applies those migrations and
then loads the deterministic development fixtures from `supabase/seed.sql`.
Local fixtures must never be loaded into a production database.

## Validation

```bash
npm test
npm run test:db
npm run lint
npm run build
git diff --check
```

### Local resilience checks

In addition to the automated suite, verify these failure paths before a release:

- Temporarily omit each browser configuration variable in an isolated local
  shell and confirm TaskFlow shows the generic configuration screen without
  attempting authentication or data requests.
- Exercise sign-out success, a controlled rejected sign-out request, and a
  successful retry. A failed request must keep the session active and show only
  the safe retry message.
- Open a protected route while signed out and confirm the login screen appears.
- Use only local mocks or the local Supabase stack for failure testing. Never
  alter production credentials or sessions to simulate an outage.

The optional three-user collaboration smoke test is local-only and refuses to
run against a non-local URL:

```bash
npm run test:collaboration:local
```

It expects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from the local Supabase CLI status. The service key
is used only by the test harness to create and remove synthetic local accounts;
it must never be added to `.env` or browser code.

## Supabase cloud migrations

Link the repository to the intended project, review the migration plan, then
push the migrations:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Always verify the linked project reference before running the final command.
Production data must not be seeded with deterministic local fixtures.
Before applying this migration history to an existing cloud project, inspect
its recorded migration versions and determine whether the historical migration
`004_seed_data.sql` was previously applied. Making the local file data-free does
not remove fixture records from a database that already executed the earlier
version; any such records require a separate, reviewed data audit.

## Vercel deployment

1. Import the GitHub repository into Vercel or run `vercel link`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and
   Preview environments.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Deploy and verify authentication, personal data, collaboration, realtime,
   route refreshes, and responsive layouts.

`vercel.json` rewrites every path to `index.html` so direct navigation to `/`,
`/tasks`, `/calendar`, `/inbox`, `/projects`, `/projects/:id/board` and
`/settings` works. It enumerates no individual routes, so adding a route needs
no deployment change.

## Production prerequisites and backlog

- Configure custom SMTP with a verified sender domain before enabling public
  self-service signups. Supabase's default SMTP is intended for testing and is
  not a production delivery service.
- Keep email confirmation enabled when custom SMTP is introduced, and validate
  confirmation delivery with a fresh inbox before announcing public signup.

### Production pre-launch checklist

- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist in the intended
  deployment environments.
- Confirm all reviewed migrations are applied and RLS remains enabled and
  covered by the database-policy tests.
- Keep custom SMTP disabled until `mail.bohaus.in` is verified; DNS verification
  remains an external prerequisite.
- Complete owner, editor, and viewer smoke tests with separate accounts.
- Verify sign-out failure leaves the current session intact, retry succeeds,
  expired sessions return to login, and protected routes never render account
  data while signed out.
- Confirm no Supabase service-role key, secret key, provider secret, or token is
  present in any frontend `VITE_` variable.

## Security

- The browser uses only the Supabase anon/publishable key.
- RLS scopes personal records to their owner and project records to authorized
  members and roles.
- Invitations, assignments, comments, activity, and notifications have
  dedicated database constraints, triggers, and RLS policies.
- `.env`, build output, logs, and local Supabase state are ignored by Git.
