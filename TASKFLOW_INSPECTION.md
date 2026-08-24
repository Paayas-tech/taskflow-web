# TaskFlow inspection, diagnosis, and plan

Baseline: `feature/task-ownership` at `3528229`; clean working tree; local and `origin/feature/task-ownership` synchronized before this report. No `AGENTS.md` or CI configuration was found. Cloud Supabase/Vercel/Resend settings and production data were not accessed.

## 1. Architecture map

- **Entry/routing:** `src/main.jsx` mounts React. `src/App.jsx` coordinates auth, browser history, global data, mutations, reminders, and page composition. `src/app/appRoutes.js` owns pure routes for `/`, `/today`, `/tasks`, `/projects`, `/projects/:projectId`, `/calendar`, `/settings`, `/archived-tasks`, and `/recover`; unknown paths fall back to `/`.
- **Auth:** `infrastructure/supabase/client.js` creates one persisted, auto-refreshing client with URL-session detection. `authRepository.js`, `authService.js`, and `authDomain.js` wrap and normalize Supabase auth. `Login.jsx` handles signup/login/resend; `Recover.jsx` handles reset requests/password updates. `App` consumes `onAuthStateChange`.
- **Identity:** `public.users` is the canonical profile table. A trigger copies `display_name`/`full_name` and avatar metadata from `auth.users`; Settings updates auth metadata and the profile row.
- **Projects:** `ProjectsPage.jsx` handles owned/shared lists, invitations, and project mutations. `ProjectTasksPage.jsx` coordinates project tasks, columns, members, board/list/calendar, task mutations, assignments, task editor, and activity.
- **Collaboration/data:** `projectService.js` fronts `projectRepository.js`, which currently contains project CRUD, membership, invitations, board/task operations, assignments, comments, activity, and realtime.
- **Kanban:** `ProjectBoard.jsx`, `ProjectTaskCard.jsx`, and `domain/projectBoardDomain.js` render and compute grouping/placement.
- **People:** `ProjectMembersModal`, `MemberRow`, `InvitationRow`, and `TaskAssigneeSelector` present collaboration identities.
- **Comments/history:** `TaskComments`/`CommentRow` manage comments; `ActivityFeed`/`ActivityRow` load task- or project-filtered persistent events. TaskEditModal already embeds a task-filtered feed; ProjectTasksPage also embeds a compact project feed.
- **Notifications:** migration 007 creates them; `notificationRepository`, `notificationService`, and `NotificationsPanel` load/mutate/subscribe.
- **Loading:** App loads personal tasks, lists, projects, assignments, invitations, and settings. Auth-user stale results are rejected. ProjectTasksPage loads tasks/columns/members together and rejects stale workspace responses using a request counter.
- **Realtime:** comments, activity, and notifications use `postgres_changes`; project workspace data itself is not realtime subscribed.

## 2. Data model and RLS map

Migrations are ordered `001`–`007`; no separate seed was found.

| Table | Purpose / important relationships |
|---|---|
| `auth.users` | Supabase auth identities. |
| `public.users` | PK/FK to auth user; normalized unique email, display name, avatar; canonical profile. |
| `projects` | Owner FK, status/dates; trigger creates owner membership. |
| `project_members` | Project/user membership; owner/editor/viewer roles after migration 006. |
| `project_invitations` | Project, normalized invitee email, inviter, role, state, expiry/acceptance. |
| `project_columns` | Ordered Kanban columns. |
| `tasks` | Optional project, creator, column, status/priority/position, dates/reminders/archive/version. |
| `lists`, `task_list_placements` | Personal lists and placements. |
| `task_assignments` | Task/user relation; migration 007 makes task unique (zero/one assignee). Trigger requires project membership. |
| `task_comments` | Task, author, content/edit timestamps. |
| `activity_events` | Optional project/task, actor, event type, JSON metadata, timestamp. |
| `notifications` | User, optional project/task, type/data/read timestamp. |
| `project_documents` | Project document hierarchy. |
| `user_settings` | Per-user preferences and notification/reminder configuration. |

Indexes cover membership/user, owner, pending invitation email, task project/status/creator/assignee, list placement, comment/task, activity/project and activity/task, notifications/unread, and documents.

RLS preserves membership-based project reads and owner/editor/viewer writes. Assignments are member-readable and owner/editor-writable; comments are task-reader-visible with author-only edit/delete; activity is project-member-visible; settings/notifications are self-only. Critically, `public.users` is self-select/self-update only, so teammate-name projection is not currently possible through ordinary client joins.

## 3. Authentication flow map

### Signup/confirmation

1. Login calls `signUp(email, password, "", {emailRedirectTo: window.location.origin})`; no name field exists.
2. The repository sends `display_name` metadata; the auth trigger persists it even when confirmation is required.
3. A user/no-session response shows confirmation guidance and returns the form to login mode.
4. The email returns to the origin root. Supabase `detectSessionInUrl` interprets the callback and emits an auth event.
5. App routes to `/recover` **only** for the exact `PASSWORD_RECOVERY` event. Ordinary confirmation stays in the normal authenticated/login flow.

There is no manual token/hash/type parsing, `/auth/callback`, or code exchange in this repository.

### Login/session/recovery

- Password login uses `signInWithPassword`; the client persists and auto-refreshes sessions.
- App relies on `onAuthStateChange` for startup/current session; it does not explicitly call `getSession`.
- A changed user ID clears previous-user state. Same-user events still call `setUser`.
- Reset request uses `${window.location.origin}/recover`. A valid callback emits `PASSWORD_RECOVERY`; App activates recovery mode and replaces the URL with `/recover`; Recover then calls `updateUser({password})`.

Allowed redirects and email templates are cloud configuration, not repository state. The exact deployed email URL/template cannot be proven here and needs a sanitized Dashboard check plus a real link test.

## 4. Loading/lifecycle map

- No `visibilitychange`, window focus, or blur listener exists.
- Supabase can emit `TOKEN_REFRESHED` with a new user object for the same ID. App always calls `setUser(currentUser)`.
- Global loaders are memoized with `[user]`; new object identity recreates them and retriggers the aggregate loading effect.
- `loadProjects` sets `projectsLoading` true. ProjectTasksPage treats that prop as a full-page `Loading project...` state even if existing project/workspace data remains available.
- Likely observed chain: tab activation → token refresh → same-user auth event → user object replacement → loaders rerun → cached UI hidden by initial-loading presentation.
- Auth-user and workspace request guards prevent many stale writes, but loading does not distinguish initial load from background refresh.
- Realtime cleanup removes channels, but subscribe status callbacks are not used, so asynchronous channel errors/reconnect status are not handled.

## 5. Activity/history map

- Migration 007 triggers persist task creation/update/status/completion, assignment/unassignment, and comment create/update/delete activity.
- Rows already contain `project_id`, `task_id`, `user_id`, event type, metadata, and timestamp. Project/task indexes exist.
- `getTaskActivity` filters by `task_id`; TaskEditModal already shows task-only history. No schema migration is needed for task isolation.
- Comments remain separate rows while their triggers also emit activity and notifications.
- Actor rendering uses raw IDs. A task feed subscribes to all activity for its project, causing extra reloads, though the subsequent query stays task-filtered.
- Whether the compact project-level feed should remain is a product decision.

## 6. Identity/display-name map

- Canonical source: auth metadata plus `public.users.display_name`; profile creation is trigger-based and profile editing already exists.
- Signup plumbing accepts a name, but Login passes an empty string.
- Member/comment/activity queries select IDs without profile enrichment. No shared identity repository/helper exists.
- Raw IDs appear in member rows, invitation sender text, assignee selector/filter, task cards, comments, mention help/highlights, and activity rows. Notifications store actor IDs but current copy does not render them.
- Safe legacy fallback should be `TaskFlow user`/`Unnamed member`, never a UUID. Email local-parts should not be exposed without an explicit privacy decision.
- Self-only profile RLS blocks a safe UI-only fix. A membership-scoped database read boundary must be designed first.

## 7. Existing test map

- Current recorded frontend baseline: **41 files, 331 tests passing**.
- Database: two pgTAP files; latest recorded run **87 assertions passing**.
- Local smoke: `scripts/phase5-local-smoke.mjs`; latest recorded owner/editor/viewer, RLS, realtime, cleanup run passed.
- Covered well: route helpers, auth domain/repository basics, services/domains, modal lifecycle, project/member/task/settings components, Kanban logic, notification repository, ProjectTasksPage coordination, TaskForm reminders.
- Gaps: rendered Login/Recover and callback routing; auth event/session lifecycle in App; token-refresh/background loading; ActivityFeed/ActivityRow; comment/mention/member/task-card identity; realtime status/reconnect; compact responsive UI; end-to-end display-name/RLS contract.
- Commands: `npm test`, `npm run lint`, `npm run build`, `npm run test:db`, `npm run test:collaboration:local`, `npm run test:all`. No separate type-check script exists.

## 8. Root-cause diagnoses (A–K)

### A — Confirmation opens password reset

- Current code sends confirmation to root and enters recovery only on `PASSWORD_RECOVERY`.
- The reported behavior is not reproducible from static repository logic. Likely external causes are an incorrect confirmation template/link variable, redirect allow-list/site URL mismatch, or provider event semantics.
- Minimal next step: auth-event routing tests plus sanitized cloud/template/link verification. Change frontend only after reproducing a mishandled callback.
- Classification: external auth configuration/provider callback, not yet proven.

### B — Reload on tab activation

- Root cause: same-user auth event object identity drives loader callback changes; shared initial/background loading flags hide cached content.
- Minimal fix: depend on stable user ID, handle auth event semantics explicitly, avoid needless same-user state replacement, and separate initial from background loading while retaining stale guards.
- Tests: initial load, same-user `TOKEN_REFRESHED`, repeated events, existing-state preservation, user switch/sign-out, stale responses, project switching.
- Classification: frontend lifecycle/state.

### C — Task-level history

- Task association and filtering already exist; no new architecture/migration is needed.
- Remaining gaps: actor names, overly broad project subscription for task feeds, and product decision on project feed.
- Tests: task isolation, persistence, event labels, actor fallback, subscription filtering/cleanup.
- Classification: query/UI/realtime.

### D — Human-readable names

- Root cause: repositories return IDs only, no central resolver, and profile RLS is self-only.
- Minimal secure fix: batch membership-scoped identity projection, central fallback/mapper, then incremental UI enrichment.
- Risk: cross-project/invitation privacy. Requires owner approval of the RLS/API shape.
- Classification: data access/RLS/UI.

### E — Signup name

- Existing repository/trigger already persists a supplied name; UI lacks the field/validation.
- Minimal fix: signup-only name input, small validator, pass value to existing `signUp`; no new table.
- Tests: validation, metadata payload, confirmation-required persistence, legacy blank-name fallback.
- Classification: frontend.

### F — Member-based visible assignee

- Exactly one optional assignee, member selection, database membership enforcement, clearing, and role permissions already exist.
- Defect is identity presentation: selectors/cards show IDs.
- Minimal fix: reuse enriched members and display `assigneeName`; UUIDs remain internal.
- Classification: UI/data projection; database enforcement is already sufficient.

### G — Projects vertical space

- Marketing-style header copy and spacing delay the lists.
- Minimal fix: compact current header/copy/spacing; preserve invitations, actions, My Projects, Shared with Me, cards, and empty states.
- Classification: UI/CSS.

### H — Shared-project semantics

- Current membership-visible project query and `viewerRole` derivation are correct; no defect found.
- Preserve and add regression coverage for member lookup, navigation, and roles. Do not weaken RLS.

### I — Large project header

- Current hero includes label/name/description/actions and consumes substantial vertical space.
- Minimal fix: compact hierarchy/padding while retaining navigation, Members, New Task, and Board/List/Calendar.
- Classification: UI/CSS.

### J — Statistics

- Total/Active/Completed summary is presentation-only; no functional dependency found.
- Product decision required: remove it or replace it with compact inline counts.
- Classification: UI.

### K — Live activity errors

- `.subscribe()` status is ignored; `try/catch` catches only synchronous construction, not asynchronous channel errors. Production publication cannot be verified from Git, though migration 007 adds it.
- Minimal fix: separate fetch error from realtime status; handle `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED`; preserve fetched rows; use task filter for task feeds where supported; clean up/retry safely.
- Tests: ordinary load without realtime, success/failure/status transitions, cleanup, identity/scope changes, retained activity.
- Classification: realtime/lifecycle/configuration.

## 9. Reviewable implementation checkpoints

1. **Auth tests and signup name** — medium risk; Login/auth tests only, no migration; manual deployed confirmation/recovery verification.
2. **Membership-scoped identity projection** — high security risk; approved narrow migration/API plus pgTAP and repository tests.
3. **Human-readable collaboration/assignee UI** — medium risk; consume checkpoint 2 in member/invitation/assignee/card/comment/activity surfaces.
4. **Auth-event/background loading stabilization** — medium-high risk; App/ProjectTasksPage lifecycle tests; no database changes.
5. **Activity realtime hardening/task filter** — medium risk; repository/service/feed tests; no schema change expected.
6. **Compact Projects/workspace UI** — low-medium risk; components/CSS/tests; requires statistics decision.

Each checkpoint is independently reviewable and should run focused tests, then `npm test`, `npm run lint`, `npm run build`, and `git diff --check`. SQL work additionally requires `npm run test:db` and `npm run test:collaboration:local`.

## 10. Database/RLS assessment and stop decisions

- **No migration needed** for signup-name persistence, one-assignee enforcement, assignment membership validation, task activity association/indexing, notifications, or shared-project access.
- **Likely migration/API needed** for teammate names because canonical profiles are self-readable only. Do not grant all authenticated users broad profile access.
- Option 1: project-membership-scoped SELECT policy for only users sharing a project. Simpler client joins; requires rigorous cross-project leakage tests.
- Option 2: security-definer RPC/view returning only ID, sanitized name, and avatar for a requested accessible project. Narrower output, but function ownership/search-path/security require care.
- Invitation sender names need an even narrower path because invitees may not yet be members: invitation-scoped RPC or a safe display-name snapshot. Global profile access is not justified.
- Existing blank names require no destructive migration; use a non-ID fallback and existing Settings profile editing.
- Migration 007 already publishes notifications, comments, and activity for realtime; production state still needs verification.

### Decisions required before implementation

1. Approve profile access via membership-scoped SELECT policy or narrow RPC/view, including invitation-sender handling.
2. Choose whether project-level activity remains, is removed, or is reduced while task history stays primary.
3. Choose removal versus compact inline presentation for project statistics.
4. Provide high-level results only from Supabase redirect/template review and a fresh confirmation-link test; never share tokenized URLs, recipient addresses, or template contents.

Implementation is intentionally paused at the prompt's stop conditions. This inspection changed no application behavior, schema, RLS, cloud configuration, Git history, or deployment.

INSPECTION_STATUS: COMPLETE

## Screenshot/video UI review (2026-08-24)

- The supplied production captures came from the older collaboration UI and exposed internal UUIDs in incoming invitation copy, mention guidance, and activity actors. The current working tree resolves those identities through the membership-scoped profile projection and the centralized `TaskFlow user` fallback; raw IDs remain internal values only.
- The same captures showed the pre-compaction Projects marketing heading, oversized project workspace hero and statistics strip, and the project-level Recent activity block. The current working tree removes the duplicate Projects heading, compacts the workspace hero, removes the presentation-only statistics, and removes the noisy project-level feed while retaining task-specific history.
- Realtime failures now preserve fetched comments/activity and show a non-destructive paused-updates notice. Structured mention controls show display names and store stable IDs without exposing UUIDs in composition or rendering.
- Added direct collaboration identity regression coverage for invitation senders, member rows, assignee choices, activity actors, and missing-profile fallbacks.

## Implementation progress and stop decision (2026-08-24)

### Completed locally

- Checkpoint 1 adds a required, trimmed signup name with the existing 80-character profile limit and passes it through the existing Supabase signup metadata/trigger path. No confirmation/recovery routing change was made because the frontend already keys recovery exclusively from `PASSWORD_RECOVERY`.
- Checkpoint 2 introduces a proposed batched `get_visible_user_profiles(uuid[])` security-definer RPC. It returns only user ID, display name, and avatar, and only for the caller, shared project members, or the specific inviter of a valid pending invitation addressed to the caller. It does not broaden table SELECT policy access.
- A centralized identity helper uses `TaskFlow user` for missing names and never falls back to a UUID.

### Verification completed

- Focused auth tests: 4 files, 19 tests passed.
- Focused identity/repository/service tests: 3 files, 19 tests passed.
- Full frontend suite: 43 files, 339 tests passed.
- `npm run lint`: passed (exit code 0).
- `npm run build`: passed (130 modules transformed).
- `git diff --check`: passed; line-ending warnings are informational working-copy warnings.
- Database pgTAP tests were not run because this turn did not start or reset the local Supabase stack. Migration 008 must not be applied remotely until its local SQL tests pass.

### Required decision before Checkpoint 3

The current mention contract stores literal `@<UUID>` text and migration 007 extracts that format to create mention notifications. Replacing every visible UUID means the compose and edit experiences cannot keep exposing this storage form.

Available options:

1. **Structured mention markup** such as a display label plus hidden/internal UUID, with parser/trigger compatibility and legacy `@UUID` rendering. Most robust, but changes stored comment syntax, editing conversion, and the database mention parser.
2. **Name-to-ID conversion at submit time**, showing names in the editor and converting to the legacy UUID representation for storage. Smaller database impact, but duplicate display names are ambiguous and edited source still needs a reversible mapping.
3. **Resolve UUID mentions only when comments are rendered**, leaving raw UUIDs visible in compose/edit. Smallest change, but it violates the explicit requirement that no visible person label be a UUID.

Affected files include `TaskComments.jsx`, `CommentRow.jsx`, project member/profile mapping, comment tests, and the mention parsing/notification trigger in `007_task_collaboration.sql` or a new forward migration. Because this changes a persisted collaboration format and notification behavior, implementation is paused for an explicit choice.

## Structured mentions implementation and local validation (2026-08-24)

### Implemented locally

- New mentions use structured comment markup containing a stable internal user UUID and an encoded display label. Mention selection is keyed by member ID, so duplicate display names remain distinct and valid.
- The composer and comment editor show only human-readable names. Saved structured mentions and legacy `@UUID` mentions render through the membership-scoped profile map; unresolved or blank profiles render as `TaskFlow user`, never as a raw UUID.
- Mention candidates come only from the current project's authorized member list. Existing comment text, editing, permissions, RLS, activity, assignment, authentication, loading, and notification behavior remain covered by the regression suite.
- Migration 008 adds the narrow `get_visible_user_profiles(uuid[])` RPC. It exposes only `user_id`, `display_name`, and `avatar_url`; limits visibility to the caller, shared project collaborators, and the relevant pending-invitation inviter; revokes anonymous/public execution; and fixes the security-definer search path.
- Migration 009 updates the comment mention trigger for structured markup while retaining the legacy UUID parser. Legacy rows do not need to be rewritten.

### Local database and privacy validation

- `npx supabase db reset --local`: passed; migrations 001 through 009 applied locally in order.
- `npm run test:db`: passed — 4 pgTAP files, 97 assertions.
- pgTAP coverage verifies approved RPC fields, caller/collaborator visibility, unrelated-user exclusion, missing-profile fallback behavior, structured and legacy mention notification handling, and unchanged comment permission boundaries.
- `npm run test:collaboration:local`: passed — three-user owner/editor/viewer collaboration, RLS, realtime, and cleanup.
- Migration 008 and Migration 009 have **not** been applied to the remote Supabase project.

### Frontend validation

- Focused regression run: 10 files, 63 tests passed.
- Full frontend suite: 45 files, 346 tests passed.
- `npm run lint`: passed (exit code 0).
- No separate type-check script exists in `package.json`.
- `npm run build`: passed; production build completed with 132 modules transformed.
- `git diff --check`: passed; any LF/CRLF messages are informational working-copy warnings.

### Remaining manual checks and deployment ordering

- In a local browser, confirm mention insertion, duplicate-name selection, edit round trips, legacy comment display, missing-profile fallback, and realtime degradation/recovery across owner/editor/viewer sessions.
- Recheck confirmation and password-recovery links in the deployed environment after any future deployment, reporting only sanitized high-level results.
- Before deploying this frontend, separately review and approve applying migrations 008 and 009 to the remote project in order; deploying the frontend first would call an RPC that does not yet exist remotely.
- No source or database issue remains unresolved in automated local validation. Remote migration, deployment, and browser acceptance remain intentionally pending separate approval.

## Completion pass: lifecycle, realtime, and compact project UI (2026-08-24)

### Root causes addressed

- Same-user auth refresh events retain the existing user object, so dependency-driven application loaders are not restarted for an equivalent `TOKEN_REFRESHED` session.
- Project workspace loading now distinguishes the first load of a project from a background refresh. Cached tasks, columns, and members remain visible during background refreshes and temporary refresh failures; stale request guards and project-change loading behavior remain intact.
- Activity subscriptions report `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED` through a user-friendly live-update notice. Fetched history remains usable during a realtime outage, task history subscribes with a task-ID filter, and cleanup removes the channel.
- The project-level Recent Activity section was removed from the workspace; task-level history remains in the task editor and continues to query/filter by task ID.
- The Projects page now uses a compact `Projects` heading without marketing copy. The project workspace header is smaller, the large Total/Active/Completed summary was removed, and Board/List/Calendar, Members, task creation, roles, descriptions, and responsive behavior were preserved.

### Final automated validation

- Focused lifecycle/UI regression run: 4 files, 24 tests passed.
- Full frontend suite: **46 files, 350 tests passed**.
- `npm run lint`: passed (exit code 0).
- No separate type-check script exists.
- `npm run build`: passed; 132 modules transformed.
- Local reset: migrations 001–009 applied successfully in order.
- `npm run test:db`: passed — 4 pgTAP files, 97 assertions.
- Three-user collaboration smoke scenario reported PASS for owner/editor/viewer, RLS, realtime, and cleanup. The script left its Node process open after reporting success and required interruption; this is a test-harness exit limitation, not a failed scenario assertion.
- `git diff --check`: passed; LF/CRLF notices are informational.

### Manual browser acceptance

- Verified locally without credentials: normal sign-in screen, signup mode exposes the required Name field, and password recovery opens a distinct Reset your password flow.
- Authenticated collaboration, mention round trips, tab-return behavior, compact Projects/workspace rendering, and Board/List/Calendar require a signed-in local test session and remain manual checks.
- Confirmation-email behavior cannot be established from the local unauthenticated browser session. Supabase redirect allow-list, Site URL, confirmation template, recovery template, and fresh deployed confirmation/recovery flows still require sanitized dashboard/deployed-environment verification.

### Stop state

- No remote migration, dashboard/configuration change, commit, push, or deployment was performed.
- Migrations 008 and 009 remain local-only and must be separately approved and applied remotely in order before this frontend can be deployed.

## Viewer project discovery fix (2026-08-24)

- **Root cause:** `App` loaded the complete RLS-filtered accessible-project collection, but passed `editableProjects` (owner/editor only) to `ProjectsPage`. The page count used all accessible projects, which caused an accepted viewer project to be counted but not rendered.
- **Correction:** `ProjectsPage` now receives the existing `projects` collection. Its existing ownership/shared grouping and owner-only card actions remain unchanged; task-editing surfaces continue to use `editableProjects` where appropriate.
- **Files changed:** `src/App.jsx`, `src/App.test.jsx`, `src/ProjectsPage.test.jsx`, and this report.
- **Regression coverage:** owner, editor, and viewer project rendering; My Projects versus Shared with Me grouping; shared-list consistency; viewer card action restrictions; and unchanged direct viewer project routing.
- **Validation:** focused Projects/App tests passed (2 files, 14 tests); full frontend suite passed (46 files, 352 tests); lint passed; production build passed (132 modules transformed); `git diff --check` passed with informational LF/CRLF working-copy warnings only.
- **Safety:** no database records, migrations, RLS policies, Supabase state, cloud configuration, deployment, commit, or push were involved.

## Final local implementation review (2026-08-24)

### Review result

- **PASS after one narrow defect correction.** The complete tracked and untracked implementation was reviewed against the requested viewer access, authentication, identity, mentions, assignment, history, loading, realtime, and compact-project-UI contracts.
- **Concrete defect found:** `TaskRow` used the assignee UUID as its visible badge text even though the resolved display name was already available for the tooltip and avatar. This was the remaining visible raw-ID path found by the source review.
- **Correction:** `src/TaskRow.jsx` now renders `assigneeName` or the approved `TaskFlow user` fallback. `src/TaskRow.test.jsx` proves both resolved and missing-profile cases never render the UUID.

### Files and contracts reviewed

- Project discovery and authorization: `src/App.jsx`, `src/ProjectsPage.jsx`, `src/ProjectsPage.test.jsx`, `src/App.test.jsx`, `src/ProjectTasksPage.jsx`, and project service/repository changes.
- Authentication and identity: `src/Login.jsx`, `src/Login.test.jsx`, auth domain/repository tests, `src/domain/identityDomain.js`, and identity tests.
- Collaboration: task comments, comment rows, member/invitation/activity rows, assignee controls, task cards/rows, notifications, activity/realtime loaders, and their focused tests.
- Database: migrations 008 and 009 plus all four pgTAP files. Profile lookup exposes only approved identity fields, is caller/collaborator scoped, uses a fixed security-definer search path, and does not weaken existing RLS. Structured and legacy mention notification parsing both retain project-membership checks.
- UI scope: Projects and workspace headers remain compact; project statistics and project-level activity were removed/reduced while task-specific activity remains.

### Validation completed

- Focused Projects/App/TaskRow run: **3 files, 16 tests passed**.
- Full frontend suite: **47 files, 354 tests passed**.
- `npm run lint`: passed (exit code 0).
- No type-check script is configured in `package.json`, so no separate type-check was run.
- `npm run build`: passed; 132 modules transformed.
- `npm run test:db`: passed — **4 pgTAP files, 97 assertions**.
- `npm run test:collaboration:local`: the three-user owner/editor/viewer scenario reported **PASS**, including RLS, realtime, and cleanup. As previously observed, the Node process remained open after the success message and was interrupted; cleanup was reported complete before interruption.
- `git diff --check`: passed; working-copy LF/CRLF notices are informational.
- The local Supabase stack was stopped after validation. No remote database or cloud operation occurred.

### Confirmed behavior

- Viewer-only projects are rendered under Shared with Me and remain read-only; owner/editor projects and task-editing collections retain their existing behavior. Direct authorized workspace access remains unchanged.
- Project access and mention/assignee visibility remain membership-based. Signup name metadata persists, and confirmation and password recovery remain distinct flows.
- Human-readable names or the approved fallback are used throughout reviewed collaboration UI. New mentions retain stable internal IDs and labels; duplicate names remain unambiguous; legacy mentions resolve safely without exposing unresolved UUIDs.
- Task history is task-specific. Equivalent same-user auth refreshes do not restart initial loading. Realtime failures retain fetched data and produce a recoverable user-facing notice.

### Remaining manual checks and repository hygiene

- Repeat deployed browser acceptance after this UI follow-up receives separate deployment approval: signup/confirmation, recovery, profile completion, duplicate-name mention selection and editing, viewer discovery/read-only behavior, assignment, task-specific history, realtime pause/recovery, and compact responsive layouts.
- `tracked-diff-review.txt` is an untracked generated diff snapshot, not an implementation file. Keep it out of any future commit unless it is intentionally retained as an audit artifact.
- Migrations 008 and 009 were subsequently applied to the verified linked remote project in order; local and remote histories match through 009. No staging, commit, push, deployment, remote migration, Supabase dashboard, or cloud configuration change was performed during this review itself.

## Production UI follow-up implementation (2026-08-24)

### Root causes and corrections

- Existing accounts with an empty `display_name` correctly received the safe `TaskFlow user` fallback, but had no direct reminder to complete the already-supported Settings/Profile flow. A non-blocking, session-dismissible prompt now opens that existing profile editor. It waits for settings to finish loading, never infers a name from email, and disappears after a name is saved.
- The App shell already supplied the visible Projects page heading while `ProjectsPage` rendered a second internal heading. The duplicate internal title and marketing copy were removed; the compact New Project action, My Projects, Shared with Me, empty states, and role-based actions remain.
- Dashboard stacked a global heading, oversized Welcome back block, and a non-interactive three-column summary. The welcome and summary blocks were removed, the date is now compact supporting text, and Today, Up next, reminders, My work, invitations, loading, error, and empty states remain.

### Files changed for this follow-up

- `src/App.jsx`, `src/App.css`, `src/SettingsPage.jsx`, `src/ProjectsPage.jsx`, and `src/Dashboard.jsx`.
- Added `src/ProfileCompletionPrompt.jsx`, `src/ProfileCompletionPrompt.test.jsx`, and `src/Dashboard.test.jsx`.
- Updated `src/ProjectsPage.test.jsx` and `src/SettingsPage.test.jsx` with focused regression coverage.

### Validation

- Focused UI/profile suite: 6 files, 41 tests passed; the final loaded-settings guard rerun passed 5 files, 34 tests.
- Full frontend suite: **49 files, 362 tests passed**.
- `npm run lint`: passed (exit code 0).
- `npm run build`: passed; 133 modules transformed.
- `git diff --check`: passed; LF/CRLF notices remain informational.

### Remaining product/manual checks

- Existing users must choose and save their own display name; no automatic production backfill or email-derived name was introduced.
- Confirm the prompt, compact Projects actions, and compact Dashboard visually at desktop and narrow mobile widths before any later deployment.
- No database, migration, RLS, environment-variable, cloud configuration, Git staging/commit/push, or deployment operation was performed for this follow-up.
