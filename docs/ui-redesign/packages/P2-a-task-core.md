# Package P2-a — task-core

You own `src/tasks/*`, `src/projects/useProjectContext.js`, `src/styles/tasks.css`,
`src/styles/task-panel.css`. Nothing else. Do not delete old files (P4 does that).

## Read first
1. `docs/ui-redesign/DESIGN_SPEC.md` — §0, §3, §4 (primitive APIs you must use), §5 (your
   deliverable, follow it exactly), §7.2 (`taskActions` shape used by
   `ConnectedTaskDetailPanel`), §8, §11 rules, §12 tests.
2. The primitives as built: `src/ui/index.js`, `src/ui/*.jsx`, `src/styles/ui.css`,
   `src/test/elementTree.js`.
3. Old implementations you are replacing — port their *behavior* (validation, optimistic
   flows, a11y labels), not their markup:
   - `src/TaskEditModal.jsx` (detail editing, story tasks page, story archive confirmation,
     bulk actions, delete confirmation)
   - `src/TaskForm.jsx` (field set, reminder presets/validation, project/story/assignee selects)
   - `src/TaskRow.jsx`, `src/ProjectTaskCard.jsx`, `src/ProjectBoard.jsx`,
     `src/ProjectColumn.jsx`, `src/ProjectTaskQuickCreate.jsx`, `src/StoryBulkActionBar.jsx`,
     `src/StoryOverviewPanel.jsx`, `src/TaskAssigneeSelector.jsx`
   - their tests: `src/TaskEditModal.test.jsx`, `src/TaskForm.test.jsx`, `src/TaskRow.test.jsx`,
     `src/ProjectTaskCard.test.jsx`, `src/ProjectTaskQuickCreate.test.jsx`,
     `src/StoryOverviewPanel.test.jsx` — carry the meaningful assertions over to your new tests.
4. Domain helpers you should reuse (do not modify): `src/domain/taskDomain.js`
   (`isTaskComplete`, `isArchived`, `dateOnlyKey`, `classifyDateOnly`, `taskFormValuesFromTask`,
   `buildTaskEditPayload`), `src/domain/taskDueDateDomain.js`, `src/domain/reminderDomain.js`
   (`calculateReminderPreset`, `defaultReminderAt`, `getReminderValidationError`,
   `toDateTimeLocalValue`, `dateTimeLocalToIso`, `normalizeReminderAt`),
   `src/domain/identityDomain.js` (`safeDisplayName`), `src/domain/projectBoardDomain.js`,
   `src/domain/personalTaskBoardDomain.js`, `src/services/reminderService.js`
   (`requestNotificationPermission`), `src/application/projectService.js`
   (`getProjectTasks`, `getProjectColumns`, `getProjectMembers`).
5. Collaboration components you embed as-is (already moved, being restyled by another agent
   in parallel — import by these paths, do not edit them):
   `src/collaboration/TaskComments.jsx` (`{ userId, taskId, members }`),
   `src/collaboration/ActivityFeed.jsx` (`{ userId, projectId, taskId, includeComments, members }`),
   `src/collaboration/AttachmentSection.jsx` (`{ projectId, entityType, entityId, userId,
   uploaderName, canManage, compact, allowDrop, onCountChange, onMutation }`).

## Deliverables
`src/tasks/`: `taskPresentation.js` (+test), `TaskCheckbox.jsx`, `TaskRow.jsx` (+test),
`QuickAdd.jsx` (QuickAdd + named QuickAddTrigger, +test), `TaskBoard.jsx` (TaskBoard +
BoardColumn) and `TaskCard.jsx` (+tests), `TaskFilterBar.jsx` (+test), `TaskProperties.jsx`
(+test), `TaskDetailPanel.jsx` (+test), `ConnectedTaskDetailPanel.jsx` (+test),
`TaskComposerDialog.jsx` (+test), `StoryProgress.jsx`, `BulkActionBar.jsx` (+test),
`index.js` re-exporting all. `src/projects/useProjectContext.js` (+test, mocking
`../application/projectService`). CSS: `src/styles/tasks.css` (rows, checkbox, quick add,
board, cards, filter bar, bulk bar, story progress) and `src/styles/task-panel.css`
(detail panel internals, composer dialog internals, property grid/chips).

## Behavior notes (beyond the spec)
- `TaskRow`: the whole row is clickable/keyboard-openable; nested controls call
  `event.stopPropagation()`. Completed rows: title `text-decoration: line-through`, muted.
  Overdue due label uses `--color-danger`; today uses `--color-accent-text`.
  Show `PriorityIcon` always (medium is a subtle 2-bar glyph) — keep it simple.
- `TaskDetailPanel` auto-save: keep a local `values` state seeded from the task via
  `taskFormValuesFromTask(task, [])`; when the `task` prop changes (new task object after
  reload) re-seed only fields that are not currently being edited (track `dirtyField`).
  Title: save on blur/Enter if changed and non-empty. Description: save on blur if changed.
  Property changes save immediately. Reminder changes save `{ reminder, reminderAt }`
  together (`reminderAt` converted with `dateTimeLocalToIso`). Show save state text.
  `onToggleComplete` from the header button. Delete → `ConfirmDialog` (danger). Story
  archive with linked tasks → `ConfirmDialog` explaining tasks move to "No story", confirm
  calls `onArchive({ moveLinkedTasksToUncategorized: true })`.
- Personal-task panel shows `Project` select (editable projects) — choosing one calls
  `onUpdate({ projectId })` (the parent handles relocation) and the panel will re-render
  with the new task object.
- `TaskComposerDialog`: `initialValues` may include `title`, `dueDate`, `projectId`,
  `storyId`, `status`, `assigneeId`, `workType`. When `workType === 'story'`: hide
  Story/Reminder/Project chips (project is locked), title label "Story title". Submit
  disabled while `busy`; show `error` from a rejected `onSubmit`. After successful submit,
  call `onClose()` (parent decides). Reset state whenever `open` flips to true.
- `TaskBoard`: keep dnd-kit setup from `ProjectBoard.jsx` (PointerSensor distance 6,
  KeyboardSensor with sortableKeyboardCoordinates, closestCorners, DragOverlay). The card
  itself is the sortable handle (`{...attributes} {...listeners}` on the article) — but
  clicks must still open the task: use `onClick` on the inner button and rely on the 6px
  activation distance. `readOnly` disables sorting.
- `useProjectContext`: cache per projectId (module Map), TTL 60s, `reload()` bypasses
  cache, `invalidateProjectContext(projectId)` named export. Handle `projectId === null`
  (return empty arrays, `loading: false`). Guard against out-of-order responses.
- `ConnectedTaskDetailPanel`: derive `readOnly` = project's `viewerRole === 'viewer'`;
  map `taskActions.update(task, patch)` → `onUpdate`, `toggleComplete` → `onToggleComplete`,
  `archive/restore/remove/setAssignee` similarly (bind the task). After a successful
  `setAssignee` or `update` on a project task, call `invalidateProjectContext(projectId)`.
  Return `null` when `task` is null.

## Tests
Repo style (§12). Mock react hooks via the `hookRuntime` pattern (copy it into a
`src/test/hookRuntime.js` helper if you like — that path is yours to create) so components
with `useState/useEffect/useRef/useMemo/useCallback/useId` can be called as functions.
Mock `@dnd-kit/*` in board tests (return identity hooks) as the old tests did. Assert:
labels, aria attributes, class names for states, callbacks called with the right payloads,
autosave payload shapes, validation errors, read-only hiding of mutating controls.

## Verify
`npx vitest run src/tasks src/projects` passes; `npx oxlint` clean. Do not run
`npm run build` (other agents are mid-flight). Record anything other packages must know in
`docs/ui-redesign/INTEGRATION_NOTES.md` under `## P2-a task-core` (append only).
