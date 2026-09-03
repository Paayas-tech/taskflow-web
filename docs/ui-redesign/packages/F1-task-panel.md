# Fix package F1 — Task detail panel redesign

You own: `src/tasks/TaskDetailPanel.jsx` (+test), `src/tasks/TaskProperties.jsx` (+test, panel
mode), `src/tasks/ConnectedTaskDetailPanel.jsx` (+test), `src/tasks/StoryProgress.jsx`,
`src/styles/task-panel.css`, `src/styles/tokens.css` (only `--panel-w`), and — for the
"live updates paused" notice only — `src/collaboration/TaskComments.jsx` and
`src/collaboration/ActivityFeed.jsx` (+tests). Nothing else.

## User feedback being addressed
"Task view needs a lot of work, doesn't look so great. The title doesn't show when I click a
task from a project. Probably needs more width. The button tab bar (Comments/Activity/
Attachments) is weird there." Plus: personal tasks linked to a project need a way to jump to
the project.

## 1. Bug: blank title
When the panel opens for a project task (from the workspace Board/List, and possibly
elsewhere) the title textarea renders empty — a ~60px blank gap sits between the header and
the Status row. Read `TaskDetailPanel.jsx` lines 100–230 (values seeding, `dirtyFieldRef`,
the re-seed effect on `task` change) and `.panel-title` in `task-panel.css`. Find the actual
cause (candidates: the re-seed effect clearing `title`, `values` initialised from a stale
task, a CSS rule that hides text). Fix it and add tests: (a) mounts with a project task and
the textarea value equals `task.title`; (b) when the `task` prop changes to another task the
title updates; (c) while the title is being edited (dirty) a task refresh does not clobber it.

## 2. Width
`--panel-w: 560px` in tokens.css. Below 720px viewport the panel is 100vw (check ui.css
already does this; if not, add the media rule in task-panel.css scoped to `.task-panel`).

## 3. Layout redesign (Linear/Asana feel — calm, no pill tabs)
Top to bottom inside `SidePanel`:
1. **Header** (`.side-panel-header`): left `.panel-crumbs` — project name as a
   `<button class="panel-crumb panel-crumb-link">` (calls new prop `onOpenProject()` and is
   only a button when that prop exists; otherwise a span) then `›` then story name (span,
   truncated) — for personal tasks the crumb reads `My tasks`. Right: `Mark complete`
   (`Button secondary sm` with `check` icon; when complete → `Completed` with
   success-tinted class `is-complete`), Archive/Restore `IconButton`, Delete `IconButton`,
   Close `IconButton`. Read-only shows a `Badge neutral` "View only" and only Close.
2. **Title**: `.panel-title` textarea, 20px/600, auto-grow (measure `scrollHeight` in an
   effect; also set `rows` fallback), placeholder "Untitled task".
3. **Properties** (`TaskProperties mode="panel"`): a compact grid. Each row =
   `.prop-row` with `.prop-label` (16px `Icon` + 12px muted text, 112px wide) and
   `.prop-control` (the Select/date input, **borderless by default**, surface-2 background
   on hover, border + focus ring on focus, value 13px). Rows: Status (`StatusIcon` glyph
   inside the select's leading slot via a wrapper `.prop-select` that overlays the icon),
   Priority (`PriorityIcon`), Due date (calendar icon; date input + clear `x`), Assignee
   (user icon; only project tasks), Story (book icon; only project tasks that are not
   stories), Project (folder icon; only personal tasks), Reminder (bell icon; personal
   non-story only; toggle + preset + datetime). At ≥ 520px panel width lay rows in two
   columns (`grid-template-columns: 1fr 1fr`, Status/Priority on the first line, Due/Assignee
   on the second, Story/Project full width). Keep all existing behaviour and autosave.
4. **Description**: `.panel-section-label` "Description" (12px muted) then the textarea
   (borderless, hover surface-2, 14px, auto-grow, placeholder "Add a description…").
5. **Stories only**: `StoryProgress` then a `Tasks` section (existing related-task list,
   select-all + `BulkActionBar`, `QuickAdd`).
6. **Project tasks/stories only**: `.divider`, then **Attachments** section
   (`.panel-section` with `.panel-section-header`: title "Attachments" + count badge, right
   `Upload` handled by `AttachmentSection compact`) — render `AttachmentSection` here,
   no tab.
7. **Project tasks/stories only**: `.divider`, then **Activity** section header: title
   "Activity" left; right a `.text-switch` with two text buttons `Comments` | `All`
   (12px, active = text color + 1px underline in accent; `role="tablist"` semantics are
   fine). `Comments` renders `TaskComments`; `All` renders `ActivityFeed includeComments`.
   The comment composer (already inside `TaskComments`) should sit at the bottom; make the
   panel body a flex column so the thread scrolls and the composer stays visible
   (`.task-panel .side-panel-body { display:flex; flex-direction:column }`, thread
   `flex: 1; min-height: 0; overflow:auto`) — if that fights `TaskComments`' internal
   layout, keep it simple and just let the panel body scroll; do not break comments.
8. Personal tasks: no Attachments/Activity sections (there is nothing to show); end after
   Description.
Remove the `Tabs` usage from the panel entirely. Save state indicator stays (`.panel-save-state`
small muted text under the header, 12px, "Saving…" / "Saved" fade / "Couldn't save · Retry").
Delete/archive confirmations stay as `ConfirmDialog`.

## 4. "Live updates are paused" notice
In `TaskComments.jsx` and `ActivityFeed.jsx` render the live notice as a single muted line
(`<p class="collab-live-note muted">` with a 14px `info` icon) instead of a full
`InlineNotice` box. Keep the text and `role="status"`. Update their tests. Put the class in
`task-panel.css` (you don't own collaboration.css) under a comment.

## 5. New prop: onOpenProject
`TaskDetailPanel` accepts `onOpenProject?: () => void` (no args). `ConnectedTaskDetailPanel`
accepts `onOpenProject?: (task) => void` and binds it. The wiring agent (F3) passes it from
App. Add tests that the crumb is a button only when the prop exists and calls it.

## Verify
`npx vitest run src/tasks src/collaboration` passes; `npx oxlint` clean. Do not run
`npm run build` (other agents are mid-flight). Append notes to
`docs/ui-redesign/INTEGRATION_NOTES.md` under `## F1 task panel`.
