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
