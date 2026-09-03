# Fix package F3 — wiring (go to project) + preview harness fixes

You own: `src/App.jsx` (+test), `src/pages/HomePage.jsx`, `src/pages/MyTasksPage.jsx`,
`src/pages/CalendarPage.jsx`, `src/pages/ArchivedTasksPage.jsx`, `src/home/*`,
`src/project/ProjectBoardTab.jsx`, `src/project/ProjectListTab.jsx`,
`src/pages/ProjectWorkspacePage.jsx` (+tests for all), `src/dev/*`. Nothing else.

Two other agents are editing `src/tasks/*` and `src/styles/*` right now. They are adding
these props, which you wire (code against the names, do not edit their files):
- `TaskRow`, `TaskCard`, `TaskBoard`: `onOpenProject?: (task) => void`
- `ConnectedTaskDetailPanel`: `onOpenProject?: (task) => void`; `TaskDetailPanel`:
  `onOpenProject?: () => void`

## User feedback being addressed
3. "Tasks in personal tasks that are linked to projects — we need to be able to go to the
   project from that task somehow."
4b. "From the sidebar, I can only click on the first project, the next ones are not
   clickable." (Preview-only: `PreviewApp.navigate` maps every `/projects/:id/...` path to
   the same fixture project.)
6. "Dark mode is not working from the settings." (Preview-only: `PreviewApp` writes
   `document.documentElement.dataset.theme` from its own `theme` state, so saving
   `settings.theme.mode` through the Settings page has no effect. The real `App.jsx` effect
   at ~line 600 is correct — verify it and leave it.)

## Fixes
1. **App.jsx**: add `openTaskInProject(task)`: `if (!task?.projectId) return;` →
   `setSelectedTask(null)` (close the global panel), set `projectItemOpenRequest`
   (`{ projectId, itemId: task.id, request: Date.now() }`) and
   `navigate(projectPath(task.projectId, readProjectTab(task.projectId)))`. Pass it as
   `onOpenProject` to `HomePage`, `MyTasksPage`, `CalendarPage`, `ArchivedTasksPage` and to
   `ConnectedTaskDetailPanel`. Add a test.
2. **Pages**: accept `onOpenProject` and forward it to every `TaskRow`/`TaskBoard` they render
   (Home widgets included; `MyTasksWidget`, `AssignedWidget`). Inside the project workspace
   pass nothing (the user is already in the project). Update tests to assert the prop is
   forwarded.
3. **Preview harness**:
   - Track the workspace project: `navigate('/projects/<id>/<tab>')` should set a
     `previewProjectId` state (fall back to the first fixture project when the id is unknown)
     and the `workspace-*` screens must render `ProjectWorkspacePage` for that project;
     `createPreviewWorkspaceLoader` must filter `tasks` by `projectId` (add a few fixture
     tasks to the other active projects if they have none) and return the same members/
     columns. The sidebar highlights the selected project.
   - Theme: derive the document theme from `state.settings.theme.mode`; the preview's
     Light/Dark toggle and the `?theme=dark` param both write into `state.settings.theme.mode`
     (keep the URL param in sync). Saving Theme in the Settings screen now switches the
     preview.
   - Wire `onOpenProject` in the preview the same way App does (switch to the workspace
     screen for that project and open the task panel there).
4. Run the vite server briefly (`npx vite --port 5199`) and curl
   `http://localhost:5199/src/dev/PreviewApp.jsx` and `http://localhost:5199/src/App.jsx`
   for 200s to catch syntax/import errors; stop the server.

## Verify
`npx vitest run src/App.test.jsx src/pages src/home src/project` passes; `npx oxlint`
clean. Do not run `npm run build`. Append notes to `docs/ui-redesign/INTEGRATION_NOTES.md`
under `## F3 wiring`.
