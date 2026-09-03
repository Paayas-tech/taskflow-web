# Package P3-e — Project Overview tab + Stories tab

You own `src/project/ProjectOverviewTab.jsx` (+test), `src/project/ProjectStoriesTab.jsx`
(+test), and a delimited block appended to the END of `src/styles/project-workspace.css`
starting with `/* ===== Overview & Stories tabs (P3-e) ===== */`. Nothing else. Do not
delete old files. (The workspace page that renders you is built in parallel by P3-d —
follow the prop contracts below exactly.)

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §3, §4, §5 (`StoryProgress`, `TaskRow` may be
reused), §6.6 Overview/Stories bullets (your deliverable), §11, §12. Then `src/ui/*`,
`src/tasks/index.js`, `src/application/projectOverviewService.js`,
`src/domain/projectOverviewDomain.js`, old `src/ProjectOverviewPage.jsx` (+test) and the
stories view inside old `src/ProjectTasksPage.jsx` (lines ~738–762), `src/StoryOverviewPanel.jsx`.

## Contracts
```
<ProjectOverviewTab userId projectId project onOpenTask(taskId) members />
<ProjectStoriesTab stories tasks members columns selectedStoryId onOpenStory(story, triggerEl)
  onNewStory() archivedStories onRestoreStory(storyId) restoringId readOnly />
```
`stories`/`archivedStories` are story tasks (`workType === 'story'`); `tasks` are the
project's active non-story tasks (each may have `storyId`, `assigneeId`, `assigneeName`,
`status`); `members` `[{ userId, displayName, role }]`.

## Build
- `ProjectOverviewTab`: load via `projectOverviewService.load(userId, projectId)`, health
  update via `projectOverviewService.updateHealth` with optimistic revert (port from old
  page), `healthSupported === false` note. Layout per §6.6: `.overview-stats` (4 `.stat`
  cards), `.overview-grid` (left: Status card with `.bar-row`s; Overdue tasks card rows
  (title, assignee `Avatar sm` + name, due date danger, status `Badge`) clickable →
  `onOpenTask(task.id)`; Recently completed card; right: About card (description or
  muted "No description", Health `Select` for owner/editor else `Badge` with tone by
  health, Due date, Created); Members card (`Avatar` + name + role badge, up to 8, "+N
  more")). Loading skeleton; error `InlineNotice` with Retry; no-access state.
- `ProjectStoriesTab`: `.row-list` of `.story-row` per §6.6 (`book` icon, title,
  description one line, `.progress` bar 80px with `n/m`, status `Badge`, due label,
  assignee `Avatar sm`, chevron); `is-selected` when `selectedStoryId` matches; keyboard
  operable rows (`role="button"`, Enter/Space). Empty state with `New story` (hidden when
  `readOnly`). `details` `Archived stories (n)` with Restore buttons (busy when
  `restoringId === story.id`), hidden for `readOnly`.

## Tests
Repo style; mock `../application/projectOverviewService`; assert stats numbers, health
select visibility by role, optimistic revert on failure, overdue row click → `onOpenTask`,
story progress math, selected highlighting, restore button busy/hidden states.

## Verify
`npx vitest run src/project/ProjectOverviewTab.test.jsx src/project/ProjectStoriesTab.test.jsx`
passes; `npx oxlint` clean. No build.
