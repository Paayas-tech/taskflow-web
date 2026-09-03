# Package P3-d — Project workspace (page, header, Board tab, List tab)

You own `src/pages/ProjectWorkspacePage.jsx` (+test), `src/project/ProjectHeader.jsx`,
`src/project/ProjectBoardTab.jsx`, `src/project/ProjectListTab.jsx` (+tests),
`src/styles/project-workspace.css` (everything except the delimited block another package
appends for Overview/Stories). Nothing else. Do not delete old files.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §4, §5 (you compose `TaskRow`, `TaskBoard`,
`QuickAdd`, `TaskFilterBar`, `TaskDetailPanel`, `TaskComposerDialog`, `BulkActionBar`),
§6.6 (your deliverable), §8, §9 (the `workspaceLoader` prop), §11, §12. Then the real
signatures in `src/ui/*`, `src/tasks/*`, `src/collaboration/ProjectMembersModal.jsx`,
`src/projects/ProjectDialog.jsx` (built in parallel by P3-c; contract in §6.5 — import
`../projects/ProjectDialog`), `src/project/ProjectOverviewTab.jsx` and
`src/project/ProjectStoriesTab.jsx` (built in parallel by P3-e; contracts in §6.6 — import
them by path). Old `src/ProjectTasksPage.jsx` (port ALL of its data logic: load with
request-id guard, `statusForColumn`/`categoryForStatus`, optimistic quick update, move
placements, archive-story rule, restore story, bulk story update, assignee change, create
with optional assignee, quick create inheriting story filter, `openItemRequest`, story
return stack, attachment counts) and `src/ProjectTasksPage.test.jsx` (carry over the
behavioral assertions).

## Props (exact — App passes these)
```
{ userId, projectId, project, projects, projectsLoading, projectsError, onRetryProjects,
  tab, onTabChange(tab), openItemRequest, refreshToken, onProjectTasksChanged(),
  onUpdateProject(id, data), onDeleteProject(id), onBack(), formatSettings,
  browserNotificationsEnabled, defaultReminderMinutes,
  workspaceLoader = consumeProjectWorkspace }
```
Call `onProjectTasksChanged()` after any successful task mutation so App can refresh the
user's assigned tasks.

## Build
- `ProjectHeader` per §6.6 (`AvatarStack` of members → opens `ProjectMembersModal`;
  `Members`/`Invite` button; owner `Menu`: Edit project (→ `ProjectDialog` edit →
  `onUpdateProject`), Archive/Restore (`onUpdateProject(id, { status })`), Delete
  (`ConfirmDialog` → `onDeleteProject` then `onBack()`), Copy link
  (`navigator.clipboard?.writeText(location.href)`); `Tabs` Overview/Board/List/Stories
  (Stories count); right: `New task` / `New story` (Stories tab) → `TaskComposerDialog`
  with `lockProject`, `projectContext={{ members, stories }}`; viewers see `Badge` "View only").
- Filter bar (Board/List) per §6.6 with story/assignee/status/group/sort; state resets on
  project change.
- `ProjectBoardTab`: `TaskBoard` with project columns, quick create per column, bulk
  selection when story filter active + `BulkActionBar` above the board.
- `ProjectListTab`: sections per grouping (default Story: each story + `No story`; Status:
  columns; Assignee: members + `Unassigned`; None: single list); section header with count
  + collapse; `TaskRow` rows (`showProject=false`); `QuickAddTrigger`/`QuickAdd` per
  section creating with that section's story/status/assignee (assignee via
  `setTaskAssignee` after create); empty section text "No tasks"; overall empty state.
- Tab content for Overview/Stories: render `<ProjectOverviewTab userId projectId project
  onOpenTask={(taskId) => open by id} members />` and `<ProjectStoriesTab stories tasks
  members columns selectedStoryId onOpenStory onNewStory archivedStories onRestoreStory
  restoringId readOnly />`.
- `TaskDetailPanel` (from `src/tasks`) for the selected task/story with workspace data,
  `relatedTasks` for stories, return stack, bulk update, create related task, assignee
  change, attachment count callback. Read-only for viewers.
- Loading (`Spinner` + skeleton), project-not-found and error states per old page.
- `.workspace` layout: header, tabs, `.workspace-toolbar`, `.workspace-content` (board
  scrolls horizontally; list is `.is-narrow`).

## Tests
Repo style; mock services (`../application/projectService`,
`../application/projectWorkspaceLoader`, `../application/attachmentService`) and the
`../tasks`/`../project`/`../projects` components as prop-capturing functions. Assert: tab
rendering by `tab` prop, `onTabChange` calls, filters, quick create payloads (story
inherited), move → `reorderProjectTasks` + optimistic status, story archive rule, bulk update
result shape, read-only hides mutations, `openItemRequest` selects the item,
`onProjectTasksChanged` called after mutations.

## Verify
`npx vitest run src/pages/ProjectWorkspacePage.test.jsx src/project/ProjectHeader.test.jsx src/project/ProjectBoardTab.test.jsx src/project/ProjectListTab.test.jsx`
passes; `npx oxlint` clean. No build.
