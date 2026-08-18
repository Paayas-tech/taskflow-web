# TaskFlow

TaskFlow is a collaborative productivity application built with React, Vite,
and Supabase. It supports personal tasks and lists, project workspaces, Kanban,
calendar views, invitations, member roles, assignees, comments, activity, and
realtime notifications.

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
with public Google or Microsoft client IDs and secure OAuth/CalDAV backend URLs.
Provider client secrets, tokens, and app-specific passwords must remain in the
server-side integration backend.

## Local development

```bash
npm install
npx supabase start
npx supabase db reset --local
npm run dev
```

The application uses the Supabase URL and anon key from `.env`. The local
database schema is defined by the ordered files in `supabase/migrations/`.

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

## Vercel deployment

1. Import the GitHub repository into Vercel or run `vercel link`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and
   Preview environments.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Deploy and verify authentication, personal data, collaboration, realtime,
   route refreshes, and responsive layouts.

`vercel.json` rewrites application routes to `index.html` so direct navigation
to `/today`, `/tasks`, `/projects`, `/calendar`, and `/settings` works.

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
