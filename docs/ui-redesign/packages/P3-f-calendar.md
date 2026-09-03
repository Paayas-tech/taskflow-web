# Package P3-f — Calendar

You own `src/pages/CalendarPage.jsx` (rewrite in place; +test if none exists),
`src/calendar/*` (already moved here: `CalendarWeekView`, `CalendarDayView`,
`CalendarAgendaView`, `CalendarEvent`), `src/styles/calendar.css`. Nothing else. Do not
delete old files.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §4, §5 (`TaskRow`, `QuickAdd`), §6.3 (your
deliverable), §7.2, §8, §11, §12. Then `src/ui/*`, `src/tasks/index.js`, the current
calendar files, `src/domain/calendarDomain.js`, `src/domain/googleCalendarDomain.js`,
`src/domain/taskDomain.js` calendar helpers.

## Props (exact — App passes these)
```
{ userId, tasks, externalEvents, tasksLoading, tasksError, onRetry, taskActions,
  onOpenTask(task), selectedTaskId, onNewTask(initialValues), formatSettings, weekStartsOn,
  projects }
```
`tasks` = merged personal + assigned project tasks. Remove the `embedded` prop, the compact
variant, the internal `TaskEditModal`, and the `onCreateTask`/`onUpdateTask`/`onDeleteTask`/
`onArchiveTask`/`onQuickUpdateTask`/`quickTaskPendingIds`/`lists` props — use
`taskActions.toggleComplete(task)` and `taskActions.pendingIds`, `onOpenTask` for opening,
`onNewTask({ dueDate, startTime?, endTime? })` for creating (use
`createCalendarTaskInitialValues` where the old code did).

## Build
Per §6.3: header (title, `SegmentedControl` Month/Week/Day/Agenda, `Today`, prev/next
`IconButton`s, range label, `New task`); month grid with `.cal-cell`, `.cal-daynum`,
`.is-today`, `.is-outside`, `.is-selected`, `.cal-chip` (project color left bar from
`projects` lookup, accent for personal, strike-through complete, `G` prefix for Google),
`+N more` → selects the day; multi-day lanes preserved (keep `assignMultiDayLanes`,
`segmentMultiDayItems`); right `.cal-agenda` column (320px) with selected date title,
`TaskRow dense` list (Google events as read-only rows), `QuickAdd` creating a personal task
for that date via `taskActions.createPersonal({ title, dueDate })`, `Add details` →
`onNewTask({ title, dueDate })`. Week/Day: restyle time grids with tokens (hour lines
`--color-border`, now-line accent, event blocks `.cal-event` with project color). Agenda:
date groups with `TaskRow dense`. Clicking a task anywhere → `onOpenTask(task)`;
`selectedTaskId` highlights. Responsive: agenda column stacks below the grid < 1000px.

Write `src/styles/calendar.css` from scratch (old rules are gone).

## Tests
Repo style; mock `../tasks` components; assert view switching, navigation (prev/next/today)
changes range, day selection, quick-add payload includes the selected date, `onOpenTask`
wiring, Google events rendered read-only, multi-day segmentation still used.

## Verify
`npx vitest run src/pages/CalendarPage.test.jsx src/calendar` passes; `npx oxlint` clean.
No build.
