## v2.1.0 — Simplification

An internal rebuild of the client's data layer and a systematic dead-code
sweep. No route, page, or user-facing behavior changed. `git diff main
--shortstat`: 275 files changed, 5,345 insertions(+), 34,608 deletions(-).

### New client store

- Added `src/store/*`: one in-memory store, loaded once per session
  (`startSession`) and mutated **optimistically** — every action applies its
  change immediately, calls the api in the background, merges the server
  response on success, and rolls back on failure. Mutations never flip a
  loading flag and never refetch a list, so creating, editing, or completing a
  task no longer flashes a loading skeleton.
- Project workspaces are cached per project (`ensureWorkspace`): a workspace's
  tasks/columns/members load once, are served from the store on every later
  visit, and revalidate silently in the background after 60 seconds — no more
  refetch-on-every-mount from the old `key={projectId}` remount.
- Replaced `src/application/*` + `src/infrastructure/supabase/*` (39 files,
  ~4,500 lines of service/repository factories and pass-through wrappers)
  with a flat `src/api/*`: plain async functions, no store or React imports,
  one module per concern (`auth`, `tasks`, `projects`, `collaboration`,
  `attachments`, `settings`, `calendar`).
- Consolidated the domain layer: 16 `src/domain/*Domain.js` files merged into
  eight modules (`task`, `calendar`, `reminder`, `settings`, `collaboration`,
  `attachment`, `auth`, `board`), removing due-date and calendar-month logic
  that had been duplicated two or three times over.

### Testing

- Replaced the test suite that rendered against a custom React mock
  (`src/test/hookRuntime.js`) and asserted on element props
  (`src/test/elementTree.js`) with `@testing-library/react` tests that render
  real components and interact through roles and text.
- Added `src/test/fakeApi.js`, an in-memory implementation of the `api/`
  contract (with `failNext()` for rollback tests and a recorded `calls` log),
  and `src/test/renderApp.jsx` for seeding the store in page tests.

### Removed dead code

- Personal lists plumbing (`listService`, `listRepository`, `setTaskList`,
  `task_list_placements`, `listId` on tasks and task defaults).
- Decorative background themes (`TASKFLOW_BACKGROUNDS`, `settings.background`,
  the `data-background` attribute).
- Legacy task/story schema fallbacks (`missingStorySchema`, `legacy*Select`).
  Project reads retain one narrow fallback for a remote missing migration 017,
  keeping projects usable while project health remains read-only.
- The `localStorage` settings migration and legacy column mapping in
  `settingsFromRow` (`settings_data` has been canonical since migration 005).
- The dev preview harness (`src/dev/`, ~1,700 lines) and its `/__preview`
  route.
- Unused assets: `src/assets/hero.png`, `react.svg`, `vite.svg`,
  `public/icons.svg`.

### Docs

- Deleted stale planning documents: `TASKFLOW_A_TO_Z_AUDIT.md`,
  `TASKFLOW_ATTACHMENTS_DEPLOYMENT.md`, `TASKFLOW_FINDINGS_TRIAGE.md`,
  `TASKFLOW_INSPECTION.md`, `docs/ui-redesign/INTEGRATION_NOTES.md`, and
  `docs/ui-redesign/packages/` (18 files). The still-relevant deployment
  steps from the attachments doc (bucket name, migrations, privacy check) now
  live in an "Attachments" section of the README next to Google Calendar.
- Moved `docs/ui-redesign/DESIGN_SPEC.md` to `docs/DESIGN_SPEC.md`.
- `README.md`: replaced the architecture description with a two-sentence
  pointer to `docs/ARCHITECTURE.md`, fixed the routes table to the current
  page files, removed the `/__preview` mention, and trimmed Validation to
  `npm test`, `npm run test:db`, `npm run lint`, `npm run build`.

## v2.0.0 — UI redesign

A full front-end rebuild against `docs/ui-redesign/DESIGN_SPEC.md`. The data,
domain, application and infrastructure layers are unchanged; no database
migration is required.

### New information architecture

- Five routes behind one sidebar shell: `/` (Home), `/tasks` (My Tasks),
  `/calendar`, `/inbox`, `/projects`. `/settings` and `/archived-tasks` are
  full pages reached from the sidebar footer.
- A project is one workspace at `/projects/:id/{overview,board,list,stories}`;
  the last tab you used is remembered per project. `/projects/:id` and unknown
  sub-paths redirect to the Overview tab.
- Removed routes normalize to `/`: `/for-you`, `/recent`, `/starred`,
  `/planning/*`, `/plans`, `/today`.

### Removed surfaces

- For you, Recent, Starred and Planning views, and the workspace/dashboard
  navigation that fed them.
- The global top navigation bar and the notifications popover — search and
  create moved into the sidebar, notifications into Inbox.
- The settings sheet: Settings is a route page only.
- The personal lists UI (`listId` remains a task field; the list service and
  repository are untouched).
- Decorative and animated backgrounds, the Background settings panel, and the
  `data-background` attribute; the theme is `data-theme` only.
- Settings rows retired with them: Default list, Import data, External
  suggestions, Reset filter suggestions, What's new.

### New shared UI

- `src/ui/*` primitives (Button, IconButton, Avatar, Badge, Tabs,
  SegmentedControl, Menu, Dialog, ConfirmDialog, SidePanel, Field/Input/
  Textarea/Select/Checkbox, EmptyState, Spinner, InlineNotice, Kbd, Icon) on a
  single token file, `src/styles/tokens.css`, with a real dark theme.
- `src/tasks/*`: one `TaskRow`, one `TaskBoard`/`TaskCard`, one `QuickAdd`, one
  `TaskFilterBar`, one `TaskProperties`, one `TaskDetailPanel` (a side panel
  that auto-saves and replaces the old edit modal) and one
  `TaskComposerDialog` for every create flow.
- Every list, board and calendar surface now renders the same row and card, so
  completion, priority, due-date tone, story and project badges behave
  identically everywhere.
- A dev-only preview harness at `/__preview` (`src/dev/`) renders every screen
  from fixtures without a backend; it is excluded from production builds.

### Notes

- Browser preferences added: `taskflow:sidebar-collapsed`,
  `taskflow:my-tasks-view`, `taskflow:my-tasks-group`,
  `taskflow:project-tab:<projectId>`.
- `settingsDomain.allowedViewPaths` no longer accepts the removed paths; a
  saved default view pointing at one falls back to `/`.

## v1.5.0 — Stories (Jira-style) + Bulk Operations

### Stories

- Added Stories as editable project work items that group related tasks.
- Tasks can belong to one Story.
- Story labels appear on Board cards and List rows.
- Board and List views can filter by Story or show “Uncategorized”.
- Story detail page shows all linked tasks, with:
  - “+ New Task” (automatically linked to the Story).
  - “← Story” navigation to preserve context.
  - Story progress (“X/Y tasks completed”).
- Lightweight onboarding:
  - First-use banner: “Stories group related tasks. Create a Story, then add tasks inside it.”
  - Empty states for projects with no Stories and Stories with no tasks.
  - Inline hints for “Filter by Story” and “+ New Task”.

### Bulk operations

- Multi-select tasks in:
  - Story detail panel.
  - Board and List views when filtered by a Story.
- Bulk actions:
  - Change status.
  - Change priority.
  - Change assignee.
  - Move to another Story in the same project.
  - Clear selection.
- Shared bulk action bar with success and partial-failure messages.
- Viewer users cannot perform bulk changes; controls are hidden/disabled.

### Technical

- Database migration `012_project_stories.sql` adds `work_type` and `story_id` to tasks.
- Validation prevents cross-project or invalid Story relationships.
- Existing RLS policies remain intact; no policies were weakened.
- 452 tests pass; lint and production build pass.

### Upgrade notes

- Apply `supabase/migrations/012_project_stories.sql` to your Supabase project before using Stories against the live backend.
- Existing tasks without `story_id` appear under “Uncategorized”.
