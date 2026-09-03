# Package P4 — Integration

You are the only agent running. You may edit any file. Goal: the redesigned app is fully
wired, old code is gone, and `npm test`, `npm run lint`, `npm run build` all pass.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` (all of it, especially §1, §6 prop contracts, §7, §10,
§11), `docs/ui-redesign/INTEGRATION_NOTES.md` (every package's deviations), then
`src/App.jsx` and every page under `src/pages/` plus `src/shell/*`, `src/tasks/index.js`,
`src/project/*`, `src/projects/*`, `src/home/*`.

## Steps
1. **Contract reconciliation.** For every page App renders, compare the props App passes
   with the props the page destructures. Fix mismatches on whichever side deviates from
   the spec (prefer fixing the page). Same for `ConnectedTaskDetailPanel`,
   `TaskComposerDialog`, `Sidebar`, `SearchDialog`, `ProjectWorkspacePage` ↔
   `ProjectOverviewTab`/`ProjectStoriesTab`/`ProjectDialog`, `TaskDetailPanel` ↔ collaboration
   components. Check every `import` path resolves.
2. **Delete old files** listed in spec §10 (and any other now-unimported component under
   `src/` — verify with grep that nothing imports them) together with their tests. Do not
   delete domain/application/infrastructure/services modules even if unused.
3. **Tests.** `npm test` must pass. Fix or rewrite tests that assert on removed behavior.
   Keep `src/App.test.jsx` meaningful.
4. **Lint + build.** `npm run lint` clean; `npm run build` succeeds; confirm the production
   bundle does not include `src/dev` (grep dist for a fixture string).
5. **CSS hygiene.** For each `src/styles/*.css`, list class selectors and grep `src/` for
   usage; delete unused rules. Ensure no hard-coded colors outside `tokens.css` except
   project/list color inline styles and `#fff` on avatars/primary buttons.
6. **Dead references.** grep for `GlobalTopNav`, `NotificationsPanel`, `WorkspacePage`,
   `PlanningPage`, `TaskEditModal`, `TaskForm`, `ProjectTasksPage`, `Dashboard`,
   `settings-sheet`, `data-background`, `for-you`, `/planning`, `starred`, `listId` UI
   references, `TaskListsPanel` — none should remain in `src/` (domain fields like
   `listId` in taskDomain are fine).
7. **Docs.** Update `README.md` route list (`/`, `/tasks`, `/calendar`, `/inbox`,
   `/projects`, `/settings`) and add a `CHANGELOG.md` entry "v2.0.0 — UI redesign"
   summarizing the new IA and removed surfaces (For you/Recent/Starred/Planning views,
   settings sheet, notification popover, top bar, personal lists UI, backgrounds).
8. **Preview harness.** `npx vite --port 5199 &` then `curl -s localhost:5199/__preview |
   head` returns HTML; stop the server. Fix any runtime import error you can see in the
   Vite output.
9. Return: summary of fixes, list of deleted files, final test/lint/build output lines,
   and any remaining risks you could not resolve.
