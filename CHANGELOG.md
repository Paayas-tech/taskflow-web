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
