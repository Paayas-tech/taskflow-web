# Package P2-b — shell (App.jsx, routes, sidebar, search, data glue)

You own: `src/App.jsx`, `src/App.test.jsx`, `src/app/appRoutes.js` (+test), `src/shell/*`
(new), `src/inbox/useNotifications.js` (+test), `src/domain/assignmentDomain.js` (+test),
`src/domain/settingsDomain.js` (+test, only `allowedViewPaths`), `src/application/projectService.js`
(only the `includeCompleted` pass-through), `src/main.jsx` (preview hook), `src/styles/shell.css`.
Do not delete old files (P4 does). Do not edit `src/tasks/*` (being built in parallel by
P2-a — code against the contracts in the spec) or any page component.

## Read first
1. `docs/ui-redesign/DESIGN_SPEC.md` — §1 (routes), §2 (layout/sidebar), §4 (primitives),
   §5.2 `ConnectedTaskDetailPanel` + `TaskComposerDialog` contracts, §6 (page prop contracts —
   you pass these props), §7 (your deliverable, follow exactly), §8, §9 (main.jsx hook), §11,
   §12.
2. `src/App.jsx` (2000 lines — keep the auth/settings/data-loading/reminder logic; remove
   what §7.1 says), `src/app/appRoutes.js`, `src/App.test.jsx`, `src/app/appRoutes.test.js`.
3. `src/NotificationsPanel.jsx` and `src/InboxPage.jsx` — extract their load/subscribe logic
   into `useNotifications`.
4. `src/ui/index.js` and `src/ui/*.jsx` — use these primitives for the sidebar, menus,
   dialogs.
5. `src/domain/assignmentDomain.js` + test; `src/application/projectService.js`
   (`getAssignedProjectTasks`).

## Deliverables
- `src/app/appRoutes.js` rewritten per §1 (exports listed there; keep `projectIdFromPath`
  semantics; add `projectTabFromPath`; `projectPath(id, tab)`). Update its test.
- `src/shell/Sidebar.jsx` (+test), `src/shell/SearchDialog.jsx` (+test),
  `src/shell/UserMenu.jsx`, `src/shell/AppShell.jsx` (layout wrapper: `.app-shell`, sidebar,
  `<main class="app-main">`, optional mobile drawer state) — props per §7.4.
- `src/inbox/useNotifications.js` (+test with mocked `../application/notificationService`
  and `../application/projectService`).
- `src/App.jsx` restructured per §7: builds `taskActions` (§7.2), `myTasks`, owns
  `selectedTask` + `ConnectedTaskDetailPanel` host, `composer` + `TaskComposerDialog`,
  `SearchDialog`, `useNotifications`, renders pages by view with the exact props in §6.
  Import the pages from their new paths even though some do not exist yet:
  `./pages/HomePage`, `./pages/MyTasksPage`, `./pages/CalendarPage`, `./pages/InboxPage`,
  `./pages/ProjectsPage`, `./pages/ProjectWorkspacePage`, `./pages/ArchivedTasksPage`,
  `./SettingsPage`, `./auth/Login`, `./auth/Onboarding`, `./auth/Recover`,
  `./auth/ConfigurationErrorScreen`, `./collaboration/ProfileCompletionPrompt`,
  `./tasks/ConnectedTaskDetailPanel`, `./tasks/TaskComposerDialog`. (`App.test.jsx` mocks all
  of them, so tests run; the build is verified later by P4.) Keep existing behaviors:
  auth state machine, onboarding gate, recovery route, settings load/default-view redirect,
  theme (`data-theme` + `colorScheme`), `lang`, reminder scheduler + toast, optimistic
  personal quick-update queue (`quickTaskMutationsRef`) — move it into `taskActions.quickUpdate`.
  Remove list loading, workspace navigation (recent/starred), planning goals, dashboard view
  state, settings sheet, `data-background`, `GlobalTopNav`, `NotificationsPanel`,
  `DashboardInviteModal`, `WorkspacePage`, `PlanningPage` imports.
  Project workspace: `tab` from `projectTabFromPath(currentPath)`; `onTabChange(tab)` →
  `navigate(projectPath(id, tab))` and persist `taskflow:project-tab:<id>`; sidebar project
  click → `projectPath(id, storedTabOrOverview)`. `openItemRequest` as before.
  Settings: route page only; `profileRequest` counter still opens the profile panel; the
  user menu's Profile navigates to `/settings` and bumps it.
  Page `document.title`: `${pageTitle} · TaskFlow`.
- `src/styles/shell.css`: `.app-shell`, `.app-main`, sidebar (`.sidebar`, `.sidebar-brand`,
  `.sidebar-new-task`, `.sidebar-search`, `.sidebar-nav`, `.nav-item [is-active]`,
  `.nav-badge`, `.sidebar-section-title`, `.sidebar-projects`, `.project-nav-item`,
  `.sidebar-footer`, `.sidebar-user`, collapsed variants), mobile drawer (`.sidebar.is-open`
  + `.sidebar-backdrop` < 900px), `.search-result*`, `.toast` positioning if not in ui.css.
- `src/domain/assignmentDomain.js`: `includeCompleted` option (§7.2) + tests;
  `projectService.getAssignedProjectTasks` passes `{ includeCompleted: true }` (+ update its
  test if one asserts the filter).
- `src/domain/settingsDomain.js`: `allowedViewPaths` reduced to `/`, `/tasks`, `/calendar`,
  `/inbox`, `/projects`; update tests. `defaultViewPath` unchanged.
- `src/main.jsx`: dev preview hook per §9 (dynamic import of `./dev/PreviewApp.jsx` — that
  file is created by another package; guard with `import.meta.env.DEV`).
- `src/App.test.jsx` updated: mock the new page modules and shell modules; keep the valuable
  assertions (auth reset on user change, route normalization, project create flow, task
  create dispatch personal vs project, default view redirect); add tests for
  `taskActions.update` dispatch (personal vs project), `myTasks` merge/dedupe, and that the
  detail panel host closes when the task disappears.

## Verify
`npx vitest run src/App.test.jsx src/app src/shell src/inbox src/domain/assignmentDomain.test.js src/domain/settingsDomain.test.js src/application/projectService.test.js`
passes; `npx oxlint` clean. Do NOT run `npm run build`. Append notes for other packages
(e.g. exact prop names you pass) to `docs/ui-redesign/INTEGRATION_NOTES.md` under
`## P2-b shell`.
