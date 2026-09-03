# Package P3-i — Dev preview harness

You own `src/dev/*` only (`PreviewApp.jsx`, `fixtures.js`, `previewActions.js`). Do not
delete old files. `src/main.jsx` already (or will) dynamically import `./dev/PreviewApp.jsx`
when `import.meta.env.DEV && location.pathname === '/__preview'`.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §9 (your deliverable), §2, §6 (page props), §7.2
(`taskActions` shape), §7.4 (Sidebar props). Then the REAL prop signatures of everything you
render — other packages may have deviated slightly; read `src/shell/Sidebar.jsx`,
`src/shell/AppShell.jsx`, `src/pages/*.jsx`, `src/project/*.jsx`, `src/tasks/TaskDetailPanel.jsx`,
`src/tasks/TaskComposerDialog.jsx`, `src/projects/ProjectDialog.jsx`, `src/SettingsPage.jsx`,
`src/auth/*.jsx`, `docs/ui-redesign/INTEGRATION_NOTES.md`. If a page does not exist yet,
skip it and list it in your result.

## Build
- `fixtures.js`: deterministic data per §9 — `user`, `projects` (3: two owned, one shared
  as editor; one archived), `members` (3), `stories` (2 in project 1), `tasks` (~14 mixed:
  personal & project, priorities, due dates relative to today: 2 overdue, 3 today, 3 within
  a week, 2 later, 2 undated, 3 completed; assignees; one with attachmentCount 2),
  `notifications` (4, 2 unread), `invitations` (1), `settings` (normalized via
  `normalizeSettings`), `columns` (To do / In progress / Done with ids and categories).
  Export helpers `todayKey()`, `daysFromToday(n)`.
- `previewActions.js`: `createPreviewTaskActions(state, setState)` returning a
  `taskActions` object whose methods resolve after 300ms and mutate the fixture state
  (toggle complete, update patch, archive, remove, createPersonal/createInProject append a
  task with a generated id, setAssignee). Also a fake `workspaceLoader` for
  `ProjectWorkspacePage` returning `{ tasks, columns, members }` from fixtures, and fake
  notification handlers.
- `PreviewApp.jsx`: renders the app shell (real `AppShell` + `Sidebar` with fixtures and a
  working collapse toggle), a left-hand `.preview-index` (fixed, small) listing screens:
  Home, My Tasks (list), My Tasks (board), Calendar, Inbox, Projects, Project › Overview,
  Project › Board, Project › List, Project › Stories, Task panel (task), Task panel (story),
  Task panel (read-only), Composer, Project dialog, Settings, Login, Onboarding, Config error,
  Empty states (Home/My Tasks/Projects with no data). Selected screen from `?screen=` query
  param (default Home); `?theme=dark` sets `document.documentElement.dataset.theme`.
  Mock service modules are NOT possible here (real modules would call Supabase), so only
  render components that are prop-driven or accept an injected loader; for the Overview
  tab render `ProjectOverviewTab` only if it accepts injected data — otherwise render a
  static note "Overview tab requires backend". Wrap each screen in an error boundary that
  shows the error message so a broken screen never blanks the page.
- Minimal CSS inline in a `<style>` tag inside `PreviewApp.jsx` for `.preview-index` only.

## Verify
`npx oxlint` clean; `npx vite build` must still exclude `src/dev` from the production bundle
(check `dist/assets` contains no fixtures strings — run `npm run build` ONLY if the full
tree currently builds; otherwise skip and say so). Start `npx vite --port 5199` briefly and
fetch `http://localhost:5199/__preview` with curl to confirm it serves HTML, then stop it.
