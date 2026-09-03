# Package P3-a — Home page

You own `src/pages/HomePage.jsx` (+test), `src/home/*` (+tests), `src/styles/home.css`.
Nothing else. Do not delete old files.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2 (page header/body), §4, §5 (use `TaskRow`,
`QuickAdd`, `EmptyState`…), §6.1 (your deliverable), §7.2 (`taskActions`), §8, §11, §12.
Then the real code: `src/ui/index.js`, `src/tasks/index.js` (TaskRow/QuickAdd/QuickAddTrigger
props), `src/collaboration/InvitationRow.jsx`, `src/domain/taskDomain.js`
(`dateOnlyKey`, `classifyDateOnly`, `isTaskComplete`), `src/domain/settingsDomain.js`
(`effectiveMyDayDate`), `src/domain/notificationDomain.js` (`notificationLabel`),
`src/app/appRoutes.js` (`projectPath`). Old `src/Dashboard.jsx` + test for the greeting /
period logic worth keeping (greeting by hour, first name).

## Props (exact — App passes these)
```
{ userId, displayName, now, tasks, tasksLoading, tasksError, onRetryTasks,
  projects, projectsLoading, projectsError, onRetryProjects,
  invitations, invitationsLoading, onAcceptInvitation(id), onDeclineInvitation(id),
  notifications, notificationsLoading,
  taskActions, onOpenTask(task), selectedTaskId, onNewTask(initialValues), onNewProject(),
  onNavigate(path), formatSettings }
```
`tasks` = merged personal + assigned project tasks (may include completed). `now` is a
Date already adjusted for the My Day reset. `projects` includes archived ones — the widget
shows only `status === 'active'`.

## Build
- `HomePage.jsx`: `.page` > `.page-header` (greeting block as `.home-greeting`: h1
  `Good morning, {firstName}` — morning < 12, afternoon < 17, else evening; below it the
  long date `Wednesday, 2 September` and the summary line built from non-zero counts:
  `N due today · N overdue · N projects`) + `.page-actions` (`New task` primary →
  `onNewTask()`). `.page-body` with `.home-grid` (2 columns per §6.1).
- `src/home/MyTasksWidget.jsx`: tabs Today (due today, incomplete) / Upcoming (due after
  today within 7 days, incomplete) / Overdue (due before today, incomplete), counts, up to 6
  `TaskRow dense` rows (`showProject`), `QuickAdd` at the bottom (`taskActions.createPersonal
  ({ title, dueDate: tab==='today' ? todayKey : '' })`; `onOpenDetails` → `onNewTask({ title,
  dueDate })`), `View all` link (`Button ghost sm` → `onNavigate('/tasks')`).
- `src/home/AssignedWidget.jsx`: incomplete tasks with `projectId` and `assigneeId === userId`
  (fall back to `task.projectId && task.assigneeId` when `userId` missing), sorted by due
  (undated last), up to 6 rows; `View all` → `/tasks`.
- `src/home/ProjectsWidget.jsx`: active projects, up to 6, sorted by `updatedAt` desc;
  row: color square, name, role meta; click → `onNavigate(projectPath(id))` — read the
  stored tab `localStorage taskflow:project-tab:<id>` (try/catch) and pass it as the tab.
  Header `+` `IconButton` → `onNewProject()`. Empty → `EmptyState` + `Create a project`.
- `src/home/InboxWidget.jsx`: latest 5 notifications, unread styling, click →
  `onNavigate(projectPath(notification.projectId))` when present; `Open inbox` → `/inbox`.
- Invitations banner (`InlineNotice tone=info`) with `InvitationRow incoming` for each,
  wired to accept/decline with per-row busy state.
- Skeleton loading states, per-widget error notices with Retry.
- Widget shell: `.widget` = `.card` with `.widget-header` (title 14px/600, right controls)
  and `.widget-body` (rows separated by top borders), `.widget-footer`.

## Tests
Repo style; mock `../tasks` components as simple functions capturing props; assert tab
filtering, counts, greeting, quick-add payloads (dueDate for Today), navigation calls,
empty states, invitation actions.

## Verify
`npx vitest run src/pages/HomePage.test.jsx src/home` passes; `npx oxlint` clean. No build.
