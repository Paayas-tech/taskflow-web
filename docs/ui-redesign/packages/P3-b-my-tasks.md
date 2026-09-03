# Package P3-b — My Tasks + Archived tasks

You own `src/pages/MyTasksPage.jsx` (+test), `src/pages/ArchivedTasksPage.jsx` (+test —
rewrite the existing file in place), and a clearly delimited block appended to the END of
`src/styles/tasks.css` starting with `/* ===== My Tasks page (P3-b) ===== */`. Nothing else.
Do not delete old files.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §4, §5 (you compose `TaskRow`, `QuickAdd`,
`TaskBoard`, `TaskFilterBar`, `taskPresentation` helpers), §6.2 (your deliverable), §7.2,
§8, §11, §12. Then: `src/ui/index.js`, `src/tasks/index.js` and the actual prop signatures
in `src/tasks/*.jsx`, `src/tasks/taskPresentation.js`, `src/domain/personalTaskBoardDomain.js`,
`src/domain/taskDomain.js`. Old `src/TasksPage.jsx` and `src/pages/ArchivedTasksPage.jsx`
for behaviors and the old tests (`src/ProjectTasksPage.test.jsx` is not yours).

## Props (exact — App passes these)
MyTasksPage:
```
{ userId, tasks, tasksLoading, tasksError, onRetry, projects, taskActions, onOpenTask(task),
  selectedTaskId, onNewTask(initialValues), formatSettings, weekStartsOn }
```
ArchivedTasksPage:
```
{ tasks (archived personal tasks), loading, error, onRetry, taskActions, onOpenTask?, onBack(), projects, formatSettings }
```
(`taskActions.restore(task)` and `taskActions.remove(task)` for Restore / Delete permanently.)

## Build — MyTasksPage
- `.page-header`: title `My Tasks` with `.page-title-count` (open tasks), center
  `SegmentedControl` List/Board (persist `taskflow:my-tasks-view`), right `New task` →
  `onNewTask()`.
- `TaskFilterBar`: search; filters Source (all/personal/projects), Priority, Project
  (only when ≥1 project), `Show completed` checkbox chip (default off in list view; the
  Completed group is shown collapsed when on); Group by (due/priority/project/status,
  persist `taskflow:my-tasks-group`); Sort (due/priority/created/title). `Clear` resets.
- List view: groups from `groupTasksByDue` / `groupTasksBy`; `.task-group` with
  `.task-group-header` (chevron toggle, label, count) and rows; collapsed state per group in
  component state. Quick add: `QuickAddTrigger` → `QuickAdd` under the Today group (or the
  first group when not grouping by due); creates via `taskActions.createPersonal({ title,
  dueDate })`; `Add details` → `onNewTask({ title, dueDate })`.
- Board view: `TaskBoard` with the three personal columns; `onMove(placements)` → for the
  moved task determine the target column → `taskActions.quickUpdate(task, { status,
  completed })` (use `personalTaskMoveUpdate` for personal tasks; project tasks use the same
  status patch); `onQuickCreate(title, column)` → `taskActions.createPersonal({ title,
  status: column.id, completed: column.id === 'completed' })`.
- Row actions: `onToggleComplete` → `taskActions.toggleComplete(task)`; `onArchive` →
  `taskActions.archive(task)` (personal only — hide for project tasks); `busy` from
  `taskActions.pendingIds.has(task.id)`; `onOpen` → `onOpenTask(task)`.
- Mutation errors → `.page-notice` `InlineNotice tone=error` dismissible.
- Loading skeleton; load error notice with Retry; empty state per §6.2.

## Build — ArchivedTasksPage
`.page-header` title `Archived tasks` + `Back to settings` (`Button ghost` with
`arrow-left`), `.page-body.is-narrow`, `.row-list` of `TaskRow` with `onRestore`,
`onDeletePermanently` (confirm via `ConfirmDialog`), `EmptyState` "No archived tasks".

## Tests
Repo style, mock `../tasks` module components as prop-capturing functions. Assert grouping,
filters (source/priority/project), show-completed behavior, persistence keys used, quick-add
payloads, board move → status patch, archived restore/delete flows.

## Verify
`npx vitest run src/pages/MyTasksPage.test.jsx src/pages/ArchivedTasksPage.test.jsx` passes;
`npx oxlint` clean. No build.
