# Integration notes

Append-only. Each package records contract changes or requests for other packages under its own heading.

## P1 foundation

Contract notes for every package coding against `src/ui/*` and `src/styles/*`:

* **Refs are plain props (React 19).** `Button`, `IconButton`, `Input`, `Textarea`,
  `Select` and `Checkbox` accept `ref` as a normal prop and pass it to their DOM element
  instead of using `forwardRef`. `<Input ref={inputRef} />` works as expected, and every
  primitive stays a plain function component so `render()` from
  `src/test/elementTree.js` can expand it in tests.
* **Every primitive has a named export and a default export.** Import from the barrel
  (`import { Button, Icon } from "../ui"`) or from the file
  (`import { Button } from "../ui/Button"`).
* `EmptyState` accepts `icon` as an icon **name string** (`icon="folders"`, rendered as
  `<Icon name="folders" size={20} />`) or as a node.
* `Tabs` items and `SegmentedControl` options accept an optional numeric `count`
  (rendered as `.tab-count` / `.segmented-count`) in addition to `{ id, label, icon }`.
* `Dialog` spreads unknown props onto the `.dialog` element, so `role="alertdialog"` and
  `data-*` attributes can be passed through. `ConfirmDialog` also takes `cancelLabel`
  (default `Cancel`).
* `usePopover(initialOpen = false)` returns `{ open, setOpen, toggle, close, rootRef }`.
  Put `rootRef` on the element that wraps trigger + popover for outside-click closing.
* `Menu` passes `{ ref, onClick, 'aria-expanded', 'aria-haspopup': 'menu' }` to the
  `trigger` render prop; spread them onto an `IconButton`/`Button`.
* `SidePanel` ignores Escape while a `.dialog` is in the document, so dialogs opened from
  inside the panel close first.
* `Field` wraps its control in `.field-control` (needed for the inline label layout).
* **Layout classes** live in `styles/ui.css`: `.page`, `.page-header`, `.page-title`,
  `.page-title-count`, `.page-actions`, `.page-body(.is-narrow)`, `.page-notice`,
  `.toolbar`, `.toolbar-spacer`, `.section*`, `.row-list`, `.card`, `.muted`,
  `.truncate`, `.stack-2/-3/-4`, `.cluster-2/-3`, `.divider`, `.skeleton`,
  `.skeleton-row`, `.toast`, `.loading-screen`, `.menu-toggle` (hidden ≥ 900px).
* `.page` is `height: 100%`, so the shell grid row must define the height
  (`.app-shell { height: 100vh }`). `base.css` sets no `#root` rule (no IDs for styling).
* Internal helper `src/ui/cx.js` (`cx(...parts)`) joins class names; it is not exported
  from `src/ui/index.js`.
* `src/test/elementTree.js` exports `textContent`, `find`, `findAll`, `findByText`,
  `findByRole(node, role, { name })`, `props`, `isElement` and
  `render(node, depth = 6)` (expands function components; `depth` counts component
  layers). `textContent` joins sibling text with a single space.

## P2-c auth

Owned files: `src/auth/*` and `src/styles/auth.css`. Props, service calls, validation
messages and aria attributes of the four screens are unchanged, so `App.jsx` needs no
edit; `ConfigurationErrorScreen` still exports `CONFIGURATION_ERROR_MESSAGE`.

* **New shared component `src/auth/AuthBrand.jsx`** (default export, no props): the
  `.auth-brand` mark + `TaskFlow` wordmark used by Login, Onboarding and Recover. It is
  auth-local; the sidebar brand stays with P2-b.
* Class names added by `styles/auth.css`: `.auth-page`, `.auth-card`
  (+ `.auth-card-centered`, `.auth-card-top`, `.auth-card-icon`), `.auth-brand`,
  `.auth-mark`, `.auth-wordmark`, `.auth-title`, `.auth-subtitle`, `.auth-step`,
  `.auth-modes`, `.auth-form`, `.auth-submit`, `.auth-forgot`, `.auth-otp-input`,
  `.auth-alt-actions`, `.choice-list`, `.choice-card` (+ `.is-selected`,
  `.choice-card-icon`, `-body`, `-label`, `-description`, `-check`). The only rule that
  reaches into a primitive is `.auth-modes .segmented-option` (full-width mode switch);
  `.auth-submit` and `.auth-otp-input` set width/height on `.btn` / `.input` from
  outside, which is the pattern other pages can reuse.
* **Extra props spread onto primitives** (all already supported through `...rest`):
  `Button` takes `aria-label` (Onboarding back button, so the old
  "Go back and start signup over" / "Go back to profile step" labels survive), `Input`
  takes `autoFocus`, `pattern`, `inputMode`, `maxLength` and a `className`.
* **Testing note for other packages:** a screen that imports the `src/ui` barrel pulls in
  `Dialog`/`Menu`/`SidePanel`, so `vi.mock("react", () => ({ useState }))` alone is no
  longer enough — those modules read `useEffect`/`useRef`/`useCallback` off the mocked
  module. The auth tests mock those four as no-ops next to the `useState` hook runtime
  and then expand the returned tree with `render()` from `src/test/elementTree.js`
  before asserting; depth 6 is enough for `Field > Input` and `InlineNotice > IconButton
  > Icon`.
* Copy/markup changes (nothing test-covered or validation related): submit labels are
  sentence case (`Sign in`, `Create account`), "..." became "…", the login intro aside,
  the onboarding kickers ("Welcome to your workspace" / "Choose your purpose", now
  redundant with the step counter) and the configuration-error "Unavailable" eyebrow
  were dropped, and email/password inputs gained `autoComplete`
  (`email` / `current-password` / `new-password`).

## P2-d collaboration

Component names, default exports, props and service calls in `src/collaboration/*` are
unchanged. Notes for the packages that render them:

* **`ProjectMembersModal`** now renders `Dialog size="md" title="Members"` internally and
  is always "open" — keep rendering it conditionally (`{showMembers ? <ProjectMembersModal
  … /> : null}`) exactly as today. Props stay `{ userId, project, onClose,
  returnFocusElement }`. The hand-rolled focus trap / Escape handling is gone: `Dialog`
  and the nested `ConfirmDialog` ("Remove member?") handle trap, Escape and the modal
  stack, and the dialog is marked `busy` while an invite/remove/cancel is in flight, so
  Escape and backdrop dismissal are blocked then. `returnFocusElement` is still focused on
  unmount (via `requestAnimationFrame` when available).
* **Copy changes** (buttons are verbs, sentence case): comment composer submits with
  `Comment` (was `Post comment`); comment edit/delete moved into a hover `Menu` for the
  author; attachments use `Upload` + a `Menu` with `Download` / `Delete` (delete now goes
  through `ConfirmDialog` instead of an inline confirm pair); the members dialog invite
  button is `Invite` (was `Send invitation`); `InvitationRow` cancel is `Cancel` (was
  `Cancel invitation`) and its meta line reads `Invited by <name> · Editor` (was
  `Editor access from <name>`); `ProfileCompletionPrompt` is an `InlineNotice tone="info"`
  with `Set display name` / `Dismiss` (was `Add display name` / `Not now`).
* **`TaskComments` composer label**: the visible `<label>Write a comment</label>` became
  `aria-label="Write a comment"` (plus the same placeholder) on the `Textarea`, so the
  composer stays a single control. The textarea keeps `id={`comment-${taskId}`}` and
  auto-grows on input. Mention suggestions render as `.menu` / `.menu-item` chips.
* **`ActivityFeed`** keeps its `Activity` heading and `Refresh` button but drops the
  "Recent changes." subtitle; live/refresh/error states are `InlineNotice`s and the list
  is a dot timeline (`.activity-list` / `.activity-row` / `.activity-dot`). No prop
  changes (`compact`, `includeComments`, `members` all behave as before).
* **`AttachmentSection`** dropped the inline "How attachments work" tooltip and the
  per-file-type icon badge (single paperclip icon now); the 10 MB hint moved into the
  `.attachment-dropzone` text, which only renders when `allowDrop && canManage`. Error
  dismissal is `InlineNotice`'s built-in `Dismiss` icon button (was a
  `Close attachment error` button). `compact` = tighter row padding and no heading.
* **`MemberRow`** renders `Avatar` (uses `member.avatarUrl` when present), the name, an
  optional `member.email` line (project members currently carry no email, so it is
  usually omitted), then a role `Select` + remove `IconButton` for owners, or a `Badge`
  with the role label for everyone else. `aria-label` on the row is unchanged
  (`"<name>, <role>"`), and `onRemove(member, triggerElement)` still receives the trigger.
* **`ProfileCompletionPrompt`** sets its own outer margin
  (`.profile-completion-prompt { margin: 16px 24px 0 }`) so it can be dropped straight
  into the shell above `.page` as `App.jsx` does today. Wrap it in `.page-notice` instead
  if it ever moves inside a `.page-body`.
* `CollaborationIdentity.test.jsx` no longer imports `TaskAssigneeSelector`; the "no raw
  user IDs" assertions now cover `InvitationRow`, `MemberRow` and `ActivityRow` (text and
  string props). Assignee rendering is P2-a's `TaskProperties` to cover.

## P2-b shell

Contracts for every package that receives props from `App.jsx` or imports `src/app/appRoutes.js`.

**`src/app/appRoutes.js`** — rewritten per §1. Exports: `navigationItems`, `routeViews`,
`projectIdFromPath`, `projectTabFromPath`, `projectPath(id, tab = 'overview')`,
`normalizePath`, `routeViewFromPath`, `isNavigationItemActive`, `pageTitle(view,
selectedProject)`, plus one addition:

* **`projectTabs`** (extra export) — `["overview", "board", "list", "stories"]`, the tab
  ids in header order. `projectPath` falls back to `overview` for anything else, and
  `projectTabFromPath` returns `overview` for non-project paths.
* `pageMetadata` and `projectOverviewPath` are **gone** (nothing else imported them).
* View ids: `home | tasks | calendar | inbox | projects | project | settings | archived |
  recover`. `dashboard` is no longer a view id (`settings.navigation.defaultView` still
  uses the value `dashboard`, mapped to `/` by `defaultViewPath`).
* `projectIdFromPath` now accepts any sub-path (`/projects/:id/anything` → `:id`);
  `normalizePath` sends unknown sub-paths to `/projects/:id/overview`.

**`src/shell/projectTabPreference.js`** (extra module) — `readProjectTab(projectId)` /
`writeProjectTab(projectId, tab)` wrap `localStorage taskflow:project-tab:<id>` in
try/catch and validate against `projectTabs`. P3-a's ProjectsWidget can import these
instead of re-implementing the lookup.

**Shell components**

* `AppShell({ collapsed, mobileOpen, onMobileClose, sidebar, children })` → `.app-shell
  [.is-collapsed] [.is-mobile-open]` containing `sidebar`, an optional `.sidebar-backdrop`
  button and `<main class="app-main">`. `.app-main` is `position: relative` so App can
  float `.menu-toggle.app-menu-toggle` over the page header on mobile (pages get no
  `onOpenMenu` prop — deviation from §2, which put the toggle inside `.page-header`).
* `Sidebar` takes exactly the §7.4 props. Nav buttons are `.nav-item[.is-active]` with
  `aria-label` = the item label (`"Inbox, 3 unread"` / `"Projects, 1 pending invitation"`
  when a `.nav-badge` shows). Project rows are `.project-nav-item[.is-active]`; clicking
  one calls `onNavigate(projectPath(id, readProjectTab(id)))` and then `onMobileClose()`.
* `SearchDialog({ open, onClose, items, onSelect })` — App builds `items` as
  `{ id: '<type>:<entityId>', type: 'project' | 'task' | 'story', title, subtitle,
  project?, task? }`; `onSelect(item)` receives the whole item. Also exports the pure
  `filterSearchItems(items, query, limit = 12)`.
* `UserMenu({ user, collapsed, onOpenProfile, onOpenSettings, onSignOut, signOutPending })`.

**`src/inbox/useNotifications.js`** — `useNotifications(userId)` returns
`{ notifications, loading, error, liveNotice, unreadCount, markRead(id), markAllRead(),
dismiss(id), refresh() }`. `refresh()` returns `undefined` (fire and forget); the three
mutations return promises and swallow failures into `error`. Notifications carry the
`actorName` resolved from `getVisibleUserProfiles`. App calls it once; P3-g receives the
results as props and must not call the hook itself.

**Props App passes** — exactly the sets in the P3 briefs, with these clarifications:

* `HomePage`, `MyTasksPage`, `CalendarPage` all receive `tasks` = **merged** active
  personal tasks ∪ assigned project tasks (`workType !== 'story'`, not archived), deduped
  by id; completed tasks are included, so filter them per widget.
* `MyTasksPage.tasksLoading` and `HomePage.tasksLoading` are
  `tasksLoading || assignedProjectTasksLoading`; `MyTasksPage.onRetry` reloads both lists.
* `taskActions` matches §7.2. `pendingIds` is one `Set` covering personal *and* project
  quick updates. `createPersonal(values)` / `createInProject(projectId, values)` merge
  `values` over the personal-task defaults (`status: 'todo'`, `priority: 'medium'`,
  `listId: null`, …), derive `completed` from `status` when not given, and return the
  service's `{ id }`. `createInProject` also calls `setTaskAssignee` when
  `values.assigneeId` is set. `restore(task)` on a project task uses
  `updateProjectTask(..., { archivedAt: null })` (there is no `unarchiveProjectTask`).
* `ConnectedTaskDetailPanel` and `TaskComposerDialog` get `projects` = **editable**
  projects only (`viewerRole` owner/editor); every page gets the full `projects` list.
  App also passes `formatSettings`, `browserNotificationsEnabled` and
  `defaultReminderMinutes` to both as passthrough.
* `onNewTask(initialValues)` is safe to wire straight to a click handler — App ignores a
  DOM event and treats it as `{}`.
* App renders the panel/composer only when `currentView !== 'project'`; the workspace
  renders its own, and reports mutations through `onProjectTasksChanged()`.
* `SettingsPage` no longer receives `homeRequest`, `lists`, `listsLoading`, `listsError`,
  `onRetryLists`, `onCreateList`, `onRenameList`, `onDeleteList` or `onViewTasks`;
  `exportData` no longer includes `lists`. `ArchivedTasksPage.onBack()` navigates to
  `/settings` (there is no settings sheet any more).

**Domain changes** — `sortAssignedTasksForAttention(tasks, todayKey, { includeCompleted =
false })` appends completed tasks (newest `completedAt` first) when asked;
`projectService.getAssignedProjectTasks` now passes `{ includeCompleted: true }`, so
assigned-task consumers must filter completed work themselves.
`settingsDomain.allowedViewPaths` is now `/`, `/tasks`, `/calendar`, `/inbox`, `/projects`.

**`src/main.jsx`** dynamically imports `./dev/PreviewApp.jsx` under
`import.meta.env.DEV && location.pathname === '/__preview'` (P3-i must create that file or
the dev server logs a load error and falls back to `App`).

## P2-a task-core

Contract notes for every package importing `src/tasks/*` or
`src/projects/useProjectContext.js`.

* **Barrel + named exports.** `src/tasks/index.js` re-exports `TaskRow`, `TaskCheckbox`,
  `QuickAdd`, `QuickAddTrigger`, `TaskBoard`, `BoardColumn`, `TaskCard`, `TaskFilterBar`,
  `TaskProperties`, `TaskDetailPanel`, `ConnectedTaskDetailPanel`, `TaskComposerDialog`,
  `StoryProgress`, `BulkActionBar` and the `taskPresentation` helpers. Every component also
  has a default export in its own file.
* `TaskRow`/`TaskCard` take `context = { projectsById: Map, membersById?: Map }`; a missing
  map just drops the badge/avatar (no crash). Both stop propagation on their nested
  controls, so a row/card click always means "open".
* **`TaskProperties.onChange` accepts two shapes**: `(name, value)` *or* a single patch
  object. Reminder edits always arrive as one `{ reminder, reminderAt }` patch so the panel
  saves both fields in a single request — handle both shapes in your own handler.
* Extra props beyond §5.2 (all optional, defaults keep the spec behavior):
  * `TaskProperties`: `showProject` (defaults to `isPersonal`; the composer sets it so the
    project chip also shows for project tasks). The Assignee row renders only when
    `projectMembers` is non-empty (ported from the old `TaskForm`).
  * `TaskDetailPanel`: `contextLoading` (disables the property controls while a project
    context loads) and `className`.
  * `TaskFilterBar`: a filter may set `type: "checkbox"` (renders a checkbox chip and calls
    `onChange(checked)`) and `defaultValue` (decides the accent `is-active` border; falls
    back to the first option). Plain filters call `onChange(value)`.
  * `TaskBoard` owns its per-column quick-add state: pass only
    `onQuickCreate(title, column) => Promise`; there is no `quickCreateColumnId` prop.
  * `StoryProgress` accepts `columns`; with project columns the counts follow the board
    columns instead of the three statuses.
* **`useProjectContext`** loads `getProjectTasks`, `getProjectColumns`, `getProjectMembers`
  **and** `getProject` in one `Promise.all`, so `project.viewerRole` is available for
  read-only checks. The `getProject` call is failure-tolerant (`project: null`) and never
  blocks the other three. `reload()` bypasses the 60s cache; `invalidateProjectContext(id)`
  drops one project and `invalidateProjectContext()` clears everything.
* **`ConnectedTaskDetailPanel`** reads `viewerRole` from the `projects` prop first and falls
  back to the loaded project record; it omits any panel callback whose `taskActions` member
  is missing, so a partial `taskActions` object is safe. After a successful `update` or
  `setAssignee` on a project task it calls `invalidateProjectContext(projectId)`.
* **Request for P2-b:** `taskActions.archive(task, options)` must forward a second argument —
  the panel calls `archive(task, { moveLinkedTasksToUncategorized: true })` when a story with
  linked tasks is archived.
* **CSS:** `tasks.css` defines a generic `.progress` / `.progress-fill` bar. P3-e should
  reuse it for `.story-row` (adding only the 80px width) instead of redefining it.
* **Deviations from the spec, with reasons:**
  * `TaskRow` always renders `PriorityIcon` (the P2-a brief overrides §5.2's "only when
    priority !== 'medium' or dense === false").
  * The reminder row renders only for personal, non-story tasks (§5.2). Project tasks no
    longer expose reminders, which the old `TaskForm` allowed.
  * The composer's primary button reads `Create story` for `workType === "story"`
    (`Create task` otherwise); §5.2 named only `Create task`.
  * `dueDateTone(dueDate, todayKey, completed)` returns `later` for completed tasks so a
    finished row never renders red.
  * `formatDueLabel` uses `Intl.DateTimeFormat(undefined, …)`, so the exact order is the
    viewer's locale (`Sun, Aug 30` in en-US); assert on parts, not the whole string.
* **Tests:** `src/test/hookRuntime.js` (new, shared) exports `createHookRuntime()` →
  `{ react, createRunner, useState, … }`. Use it as
  `const runtime = await vi.hoisted(async () => (await import("../test/hookRuntime")).createHookRuntime());`
  followed by `vi.mock("react", () => runtime.react)`. `runtime.createRunner(Component)`
  gives `render(props)` (runs effects, returns the tree), `output` and `unmount()`; state
  setters mutate the slot, so call `render()` again to observe them. Components expanded by
  `render()` from `elementTree.js` outside a runner get initial hook values and run no
  effects, so primitives with hooks (Menu, Dialog) can be expanded safely.

## P3-g inbox

Owned files: `src/pages/InboxPage.jsx` (+ `InboxPage.test.jsx`) and `src/styles/inbox.css`.
`App.jsx` already passes exactly the documented props (`notifications`, `loading`, `error`,
`liveNotice`, `onMarkRead`, `onMarkAllRead`, `onDismiss`, `onRefresh`, `onNavigate`,
`onOpenSettings`), so nothing has to be rewired. The page never calls `useNotifications`.

* **Exports**: named `InboxPage` + default export.
* **Structure**: `<section class="page inbox-page">` → `.page-header` (h1 `.page-title`
  `Inbox`, `Tabs.inbox-tabs` `All | Unread | Mentions` with counts, `.page-actions` with
  `Mark all read` secondary and `Notification settings` ghost) → `.page-body.is-narrow`.
  The root is a direct `.page` child of `.app-main`, so the shell's mobile
  `.app-main > .page > .page-header { padding-left: 48px }` rule applies unchanged.
* **Tab ids are the `notificationDomain` view values** (`activity | unread | mentioned`)
  with the §6.4 labels (`All | Unread | Mentions`); filtering is
  `filterInboxNotifications(notifications, { view })`, so the domain defaults
  (`type: "all"`, `sort: "newest"`) apply and the Type/Sort selects are gone as specified.
* **Row** `.inbox-item[.is-unread]` is a `div role="button" tabIndex={0}` (the `TaskRow`
  pattern) rather than a nested button, because it contains the dismiss `IconButton`; the
  `.inbox-item-actions` wrapper stops click/Enter/Space propagation. Enter and Space open
  the row. Click → `onMarkRead(id)` when unread, then
  `onNavigate(projectPath(notification.projectId))` when there is a project.
* **Busy states**: the pending row carries `aria-busy` and its dismiss button is disabled;
  a row click is ignored while another row is pending. `Mark all read` is `disabled` when
  nothing is unread and `loading` (Button spinner + `aria-busy`) while the promise is open.
* **Deviations / small changes, with reasons:**
  * Mentions use a text `@` glyph inside `.inbox-item-icon.is-mention` — §6.4 asks for the
    `@` glyph and `src/ui/icons.jsx` has no `at-sign` name; no icon was added (P1 owns it).
    Assignments use `user`, comments `message-circle`.
  * Loading renders three `.skeleton-row` placeholders inside a `.row-list`
    (`role="status" aria-label="Loading notifications"`) instead of the old spinner text.
  * The empty state keeps the spec title `You're all caught up` for every tab and varies
    only the description (all / unread / mentions).
  * Copy: `Manage notifications` → `Notification settings`, `All caught up` →
    `You're all caught up`, `Try again` → `Retry`. The error string itself still comes from
    `useNotifications`, rendered verbatim in an `InlineNotice tone="error"` whose `action`
    calls `onRefresh()`; the list stays visible under it.
  * `styles/inbox.css` reaches outside its own classes in two scoped places:
    `.inbox-page .inbox-tabs` (left margin next to the title) and, under
    `@media (max-width: 899px)`, `.inbox-page .page-header` (wraps so the tabs drop to a
    second row). Flagging in case a later package restyles `.page-header`.
* `src/InboxPage.jsx` (the old page) is untouched and still on disk for P4 to delete.

## P3-e overview & stories tabs

Owned files: `src/project/ProjectOverviewTab.jsx` (+test), `src/project/ProjectStoriesTab.jsx`
(+test) and the `/* ===== Overview & Stories tabs (P3-e) ===== */` block at the end of
`src/styles/project-workspace.css`. Both components have a named **and** a default export.

* **Props are exactly the briefed contracts**, with one optional extra: `ProjectStoriesTab`
  takes `todayKey` (used for the due chip; falls back to today's local date key, so P3-d can
  omit it).
* **`ProjectOverviewTab` loads its own data** through `projectOverviewService.load(userId,
  projectId)` — the workspace passes no overview data. `onOpenTask` is called with the task
  **id only** (`onOpenTask(task.id)`); the workspace resolves it against its own task list.
  Health saves go through `projectOverviewService.updateHealth(projectId, value)` with the
  old optimistic-revert behavior; a failure reverts the select and shows a dismissible
  `InlineNotice tone="error"`.
* The About card merges the `project` prop with the loaded record (`{ ...project,
  ...data.project }`) because the overview service returns only
  `{ id, name, description, healthStatus, healthSupported, viewerRole }` — **`dueDate` and
  `createdAt` come from the workspace `project` prop**, so keep passing the full project
  record (`normalizeProjectRow` shape). `viewerRole` from the loaded record wins.
* `members` is consumed as `[{ userId, displayName, role }]`: `safeDisplayName` for the name,
  a neutral `Badge` (`Owner|Editor|Viewer`, `Member` for anything else), first 8 shown, then
  a muted `+N more`.
* **Deviations (brief wins over §6.6 where they differ):**
  * The Members card has no `Manage` link (the brief specifies `+N more`); the header's
    `AvatarStack` / `Members` button stays the way into `ProjectMembersModal`.
  * `Recently completed` rows are clickable → `onOpenTask` too (behavior of the old
    `ProjectOverviewPage`); §6.6 mentions clicks only for the overdue card.
  * Rows in both cards are `div role="button" tabIndex={0}` with Enter/Space, matching
    `TaskRow`, rather than a `Button` primitive.
  * Health badge tones (viewers / migration pending): `on_track` success, `at_risk` warning,
    `off_track` danger, `on_hold` neutral, `complete` info.
  * The old copy "Health editing is unavailable until migration 017 is applied." is kept
    verbatim when `project.healthSupported === false` (the select is hidden then, as before).
  * Status distribution renders in a fixed order (To do → In progress → Done, unknown
    statuses last) instead of raw object order.
* **`ProjectStoriesTab`** reuses `.progress` / `.progress-fill` from `tasks.css` per P2-a's
  request (only the 80px width is added as `.story-row-bar`) and `.task-due.is-{tone}` for the
  due chip. The status `Badge` reflects the story task's own status (completed → success,
  in progress → warning, to do → neutral). The `columns` prop is used for the progress bar's
  `title` breakdown (`To do 1 · Doing 1 · Shipped 1`) via `groupProjectTasksByColumn`,
  falling back to the three statuses when the project has no columns.
* Archived stories: the whole `details` block is hidden when `readOnly`; every Restore button
  is disabled while any restore is in flight (`Boolean(restoringId)`) and the pending one is
  a `Button loading` (`aria-busy`), matching the old page.
* **CSS added** (all scoped to these two tabs): `.overview-tab`, `.overview-stats` (with
  `.stat`, `.stat-value`, `.stat-label`, `.is-danger` scoped under it), `.overview-grid`,
  `.overview-skeleton-value/-line`, `.bar-row`, `.bar-label`, `.bar-value`,
  `.bar-row .progress-fill.is-todo/.is-progress/.is-done`, `.overview-task-list/-row/-title/
  -assignee/-date` (`.is-overdue`), `.overview-description`, `.about-row`, `.about-label`,
  `.overview-health-select`, `.overview-health-note`, `.overview-member`, `.stories-tab`,
  `.story-row` (`.is-selected`, `.is-archived`) with `-icon/-main/-title/-description/-meta/
  -progress/-bar/-count/-chevron`, `.archived-stories`.
* **For P3-d:** this block is at the END of `project-workspace.css` — re-read the file before
  writing so it survives. Nothing else in the file is touched.
* **For P4:** no service, domain or shared-CSS changes. `src/ProjectOverviewPage.jsx` and its
  test are now fully replaced by `ProjectOverviewTab` and can be deleted; the stories view
  inside `src/ProjectTasksPage.jsx` is replaced by `ProjectStoriesTab`.

## P3-c projects

Owned files: `src/pages/ProjectsPage.jsx` (+test), `src/projects/ProjectDialog.jsx`
(+test), `src/styles/projects.css`. `App.jsx` needs no edit — the prop set in the brief is
exactly what App passes today, and `ProjectsPage` keeps its default export.

* **`ProjectDialog`** (`src/projects/ProjectDialog.jsx`, named + default export) —
  `{ open, onClose, onSubmit(values), project = null, busy = false, error = "" }`.
  `onSubmit` receives `{ name, description, color }` with the name already trimmed; the
  dialog never closes itself, so the page owns `busy`, `error` and `onClose`. The
  name-required rule stays inside the dialog (`Field error` → "Enter a project name before
  saving."); a failed save arrives back through `error` and renders as an `InlineNotice`.
  It re-seeds from `project` every time `open` flips to true, so it can stay mounted.
* The eight-color palette is **internal** to `ProjectDialog` (not exported) so both files
  stay warning-free under `react/only-export-components`. A stored legacy hex survives an
  edit: no swatch is checked and the color is submitted unchanged. `ProjectsPage` falls
  back to `var(--color-accent)` for a project with no color (same fallback `TaskRow` uses).
* **Deviations from §6.5 / the old page, with reasons:**
  * The projects details side panel is gone (§6.5): a row click calls `onOpenProject(id)`
    directly and `onMouseEnter` fires `prefetchProjectWorkspace(userId, id)?.catch(() => {})`.
  * Row `Menu` shows `Open` for everyone; `Edit`, `Archive`/`Restore` and `Delete` only when
    `viewerRole === "owner" || ownerId === userId`.
  * The role `Badge` falls back to `Member` when a record carries no `viewerRole` and the
    viewer is not the owner (`Owner|Editor|Viewer` otherwise).
  * `Updated 3 Sep` uses `Intl.DateTimeFormat(undefined, { day, month })` (locale decides the
    order — assert on parts, not the whole string), falls back to `createdAt`, appends the
    year when it is not the current one, and is hidden below 720px.
  * `Show archived` *adds* archived projects to the list instead of switching to an
    archived-only view. The old three-way status `select` is gone: `completed` is not a
    status `projectService` produces, so `All | Mine | Shared` + the chip cover it.
  * The old "Showing X of Y projects" line is replaced by `.page-title-count` (count of
    *visible* projects) next to the title, matching `MyTasksPage`.
  * Delete uses `ConfirmDialog danger` — title `Delete “<name>”?`, confirm `Delete project`;
    a delete failure renders as an `InlineNotice` inside the confirm body.
  * Archive/restore and invitation failures share one dismissible `InlineNotice` at the top
    of `.page-body`; invitation errors keep the service's own message.
* **CSS** added by `styles/projects.css`: `.projects-page`, `.projects-archived-toggle`,
  `.projects-search`, `.projects-list-section`, `.project-row` (+ `.is-archived`),
  `.project-row-color/-main/-name/-description/-meta/-updated/-menu`, `.projects-no-match`,
  `.project-skeleton-color/-name`, `.project-dialog-body`, `.project-description-count`,
  `.project-color-picker`, `.project-color-swatch` (+ `.is-selected`). The only rule that
  reaches outside my own components is `.projects-page .page-header` (wrap + tighter
  vertical padding so the four header controls can wrap on narrow screens).
* **For P4:** the old `src/ProjectsPage.jsx` and `src/ProjectsPage.test.jsx` are no longer
  imported by anything and are safe to delete (§10).

## P3-b my-tasks

Owned files: `src/pages/MyTasksPage.jsx`, `src/pages/ArchivedTasksPage.jsx` (+ tests) and
the `/* ===== My Tasks page (P3-b) ===== */` block at the end of `src/styles/tasks.css`.
Both pages have a default **and** a named export (`MyTasksPage`, `ArchivedTasksPage`).

* **Props are exactly the sets in the brief**, minus three that the pages ignore:
  `userId`, `weekStartsOn` and `formatSettings` (Archived ignores `formatSettings` too).
  Nothing in `src/tasks/*` consumes `formatSettings`, and `TaskRow`/`TaskBoard` spread
  unknown props onto their DOM roots, so forwarding it would only produce React warnings.
  `App.jsx` can keep passing them — they are accepted and dropped, no change needed.
* `onOpenTask` is called as `onOpenTask(task, triggerElement)`; App's `openTaskDetail`
  ignores the second argument today, but it is there for focus return.
* **`taskActions` members used:** `pendingIds` (row `busy`), `toggleComplete`, `archive`,
  `quickUpdate`, `createPersonal` on My Tasks; `restore` and `remove` on Archived. Archive
  is offered for personal rows only (project rows get no `onArchive`).
* **Board moves** use `mapPersonalTasksToBoard` (column from status/completed, so assigned
  project tasks map too) + `personalTaskMoveUpdate`, and send the resulting
  `{ status, completed }` through `taskActions.quickUpdate` for personal *and* project
  tasks — per the P3-b brief, which overrides §6.2's `taskActions.update` for project rows.
* **Persistence:** `taskflow:my-tasks-view` (`list|board`) and `taskflow:my-tasks-group`
  (`due|priority|project|status`) are read once in lazy `useState` initialisers and written
  only when the user changes the control; both reads and writes are wrapped in try/catch and
  fall back to `list` / `due`, so a page rendered without `window.localStorage` still works
  (tests that render `MyTasksPage` must define `globalThis.window`).
* **Deviations from §6.2, with reasons:**
  * The `Show completed` chip and the `Group by` / `Sort` chips render **only in the list
    view** — the board always shows its Done column (collapsed initially) and grouping and
    sorting have no meaning there.
  * `Clear` (and `activeCount`) covers search + Source + Priority + Project + Show
    completed. Group-by and Sort are treated as view preferences (like the List/Board
    toggle) and survive a clear.
  * Rows inside every group follow the `Sort` chip, including the `Completed` group, rather
    than keeping `groupTasksByDue`'s internal per-bucket ordering.
  * Two empty states beyond the spec's "no tasks at all" one: *No tasks match these filters*
    (with a `Clear filters` button) when the filters hide everything, and *Nothing left to
    do* (with the quick add) when a non-due grouping produces no groups. Grouping by due
    keeps the always-present `Today` group, so its quick add never disappears.
  * Archived tasks keeps a `.page-title-count` (the old page showed the archive count) and
    drops the old explainer aside plus the `View active tasks` button; `onViewTasks`,
    `lists`, `onRestoreTask`, `onUpdateTask`, `onDeleteTask`, `projectsLoading`,
    `projectsError`, `onRetryProjects` and `browserNotificationsEnabled` are gone. The page
    no longer opens an editor itself — App owns `ConnectedTaskDetailPanel` through
    `onOpenTask`.
* **CSS added** (end of `tasks.css`): `.my-tasks-views`, `.my-tasks-groups`,
  `.task-group(.is-collapsed)`, `.task-group-header`, `.task-group-label`,
  `.task-group-count`, `.task-group-body`, `.my-tasks-board-body`, `.my-tasks-board`,
  `.my-tasks-skeleton-check`, `.my-tasks-skeleton-line`, `.archived-tasks-skeleton-line`.
  The `.task-group*` classes are deliberately generic — P3-d's List tab should reuse them
  for its collapsible sections instead of defining its own.
* **Testing note:** mock `../tasks` with prop-capturing components while re-exporting the
  real helpers (`const presentation = await import("../tasks/taskPresentation")` inside the
  `vi.mock` factory). That keeps grouping/sorting real and avoids pulling `@dnd-kit` into a
  suite where `react` is mocked. `ArchivedTasksPage.test.jsx` also mocks
  `../components/modal/useModalLifecycle` so `ConfirmDialog` can be expanded with
  `render()` from `elementTree.js`.
* Nothing is required from another package.

## P3-f calendar

Owned files: `src/pages/CalendarPage.jsx` (+ new `CalendarPage.test.jsx`), `src/calendar/*`
(+ new `CalendarViews.test.jsx`), `src/styles/calendar.css`. `CalendarPage` takes exactly the
§6.3 prop set; `App.jsx` needs no edit.

**Contracts for the integration agent**

* **`userId` is accepted but not destructured.** The page needs no user id of its own (all
  writes go through `taskActions`), so the parameter list omits it to keep oxlint's
  `no-unused-vars` quiet. Keep passing it — re-adding it later is a one-line change.
* **`onNewTask` receives `createCalendarTaskInitialValues` output**, i.e.
  `{ dueDate, endDate, startTime, endTime }` (plus `title` when it comes from a QuickAdd
  "Add details"). **`TaskComposerDialog` currently drops `endDate` / `startTime` / `endTime`**
  because `initialComposerValues` only copies keys present in its `EMPTY_VALUES`. Clicking an
  hour slot in Week/Day therefore opens the composer with the right date but no time. Nothing
  crashes; wiring the schedule fields into the composer (or into `TaskProperties`) is the
  remaining loose end.
* **Google Calendar events keep their old click behavior**: `onOpenTask` is *not* called for
  `task.source === "google"`; the page opens `task.htmlLink` in a new tab instead. Sending them
  to `ConnectedTaskDetailPanel` would immediately close the panel (they are not in `myTasks`).
* Google rows render through `TaskRow` with `readOnly` and no `onToggleComplete`, so the row
  shows the `G` badge and no checkbox.
* `taskActions` is read defensively (`taskActions.toggleComplete`, `taskActions.createPersonal`,
  `taskActions.pendingIds`); a partial object degrades instead of crashing.

**Deviations from §6.3 / the P3-f brief (with reasons)**

* **Prev/next are hidden in Agenda view** (as in the old page): the agenda lists every dated
  item, so a period step has nothing to move. `Today` and the range label (`Agenda`) stay.
* **A month cell click selects the day instead of creating a task.** The old page had an
  invisible "create a task on this date" hit area over each cell; §6.3 moves creation to the
  agenda column's `QuickAdd` and the header `New task`, and a selectable cell is what the
  `+N more` link and the agenda column now need. The day number is part of that hit area.
* **The "After <month>" upcoming list is gone** from the agenda column (§6.3 lists only the
  date title, the `TaskRow dense` list and `QuickAdd`), so `upcomingCalendarTasks` is no longer
  imported by the page. It is still exported from `taskDomain`.
* **Agenda view keeps its Overdue / Today / Upcoming sections** around the per-date groups
  (existing behavior; §6.3 only specified "grouped by date"). Selecting a date group switches
  to Day view for that date.
* The month grid renders **the day number above the multi-day lanes** (lanes push the single-day
  chips down via `--cal-lane-count`), which is the only way the 12px top-right number stays
  visible.

**Class names added by `styles/calendar.css`** — `.calendar-page`, `.cal-views`, `.cal-nav`,
`.cal-range`, `.cal-body`, `.cal-loading`, `.cal-skeleton`, `.cal-layout`, `.cal-grid`,
`.cal-weekdays`, `.cal-weekday`, `.cal-week-row`, `.cal-cell` (+ `.is-today`, `.is-outside`,
`.is-selected`), `.cal-cell-select`, `.cal-daynum`, `.cal-cell-events`, `.cal-more`,
`.cal-multiday`, `.cal-chip` / `.cal-event` (+ `.cal-ev-{allday|timed|multiday}`,
`.is-complete`, `.is-google`, `.is-selected`, `.continues-before`, `.continues-after`),
`.cal-ev-source`, `.cal-ev-time`, `.cal-ev-title`, `.cal-ev-reminder`, `.cal-agenda`,
`.cal-agenda-header`, `.cal-agenda-title`, `.cal-agenda-count`, `.cal-agenda-view`,
`.cal-agenda-section`, `.cal-agenda-group`, `.cal-agenda-date`, `.cal-agenda-entry`,
`.cal-agenda-time`, `.cal-timegrid`, `.cal-timegrid-scroll`, `.cal-week-surface`,
`.cal-gutter`, `.cal-week-headings`, `.cal-week-heading`, `.cal-allday`, `.cal-allday-label`,
`.cal-allday-cells`, `.cal-allday-cell`, `.cal-allday-events`, `.cal-allday-empty`,
`.cal-day-allday`, `.cal-day-allday-events`, `.cal-time-scroll`, `.cal-time-canvas`,
`.cal-time-axis`, `.cal-hour-lines`, `.cal-week-columns`, `.cal-day-column`, `.cal-slot`,
`.cal-now-line`. The only rules reaching outside the package are `.cal-agenda-entry > .task-row`
(flex sizing) and the reuse of `.row-list`, `.section*`, `.page-notice`, `.skeleton` and
`.muted` from `ui.css`. Colors come from tokens; the chip/event left bar reads the stored
project hex through a `--cal-event-color` inline custom property.

**Component prop changes inside `src/calendar/*`** (all default + named exports now):

* `CalendarEvent({ task, onClick, viewContext, segment, style, displayTime, formatSettings,
  projectsById, selected })` — new `projectsById` (color lookup) and `selected`; renders
  `.cal-chip` for `viewContext="month"` and `.cal-event` otherwise.
* `CalendarWeekView` / `CalendarDayView` — `onEditTask` renamed to `onOpenTask(task, element)`;
  new `todayKey`, `nowMinutes` (accent now-line), `selectedTaskId`, `projectsById`. `onCreateTask`
  still receives `createCalendarTaskInitialValues(...)` output.
* `CalendarAgendaView({ tasks, todayKey, selectedTaskId, projectsById, pendingIds, onSelectDate,
  onToggleComplete, onOpenTask, formatSettings })` — the old `lists`, `projects`,
  `quickTaskPendingIds`, `onEditTask`, `onArchiveTask` props are gone; rows are `TaskRow dense`.

**Tests**: `src/pages/CalendarPage.test.jsx` and `src/calendar/CalendarViews.test.jsx` mock
`react` with `createHookRuntime()` and `vi.mock("../tasks")` (stub `TaskRow` / `QuickAdd`), then
assert on the element tree. They pin the clock with `vi.useFakeTimers({ toFake: ["Date"] })` at
2026-09-02 10:30 and derive expected date strings from `Intl` rather than hard-coding them.

## P3-a home

Owned files: `src/pages/HomePage.jsx` (+test), `src/home/*` (+tests), `src/styles/home.css`.
`HomePage` consumes exactly the props `App.jsx` passes today, so no shell edit is needed.
It has a named **and** a default export (`import HomePage from "../pages/HomePage"` keeps
working).

**New modules inside `src/home/`** (P4 may reuse them, nobody else has to):

* `Widget.jsx` — `Widget({ title, actions, footer, children, className })` renders
  `<section class="widget" aria-label={title}>` with `.widget-header` (h2 `.widget-title` +
  `.widget-actions`), `.widget-body` and an optional `.widget-footer`. Also exports
  `WidgetSkeleton({ rows = 3, label })` (`role="status"` + `.skeleton-row` bars) and
  `WidgetError({ message, onRetry })` (an `InlineNotice tone="error"` with a `Retry` button).
* `homeData.js` — pure, tested helpers: `shiftDateKey`, `homeTaskBuckets(tasks, todayKey)`
  (`{ today, upcoming, overdue }`, open tasks only, `upcoming` capped at 7 days),
  `assignedHomeTasks(tasks, userId, todayKey)`, `activeProjects`, `recentProjects(projects,
  limit)` and `latestNotifications(notifications, limit)`.
* The four widgets (`MyTasksWidget`, `AssignedWidget`, `ProjectsWidget`, `InboxWidget`) each
  take `{ loading, error, onRetry }` and render skeleton → error → empty → rows in that order.

**Contract notes and deviations, with reasons:**

* **`TaskRow` swallows `formatSettings` into `...rest`** (it is not destructured in
  `src/tasks/TaskRow.jsx`), so passing it would spread an unknown attribute onto the row
  `div`. Home therefore does **not** forward `formatSettings` to rows; it only uses
  `formatSettings.format` for the Inbox widget's timestamps (`hour12`). If P2-a/P4 wires
  `formatSettings` into `TaskRow`, Home can start passing it with a one-line change.
* `HomePage` deliberately does not destructure `invitationsLoading`: the banner renders only
  when `invitations.length > 0` and the per-row busy state already spans App's reload. App can
  keep passing it (oxlint flags unused parameters, so it is left out of the signature).
* **Error handling**: `tasksError` is shown in *both* task widgets (both depend on that load)
  and a widget's notice replaces its rows rather than sitting above stale ones.
* `AssignedWidget` sorts with `sortAssignedTasksForAttention(…, todayKey)` (overdue → today →
  upcoming → undated), which is the spec's "sorted by due, undated last" plus the domain's
  priority tie-break, and it filters completed work itself as §7.2 requires.
* `InboxWidget` rows without a `projectId` navigate to `/inbox` instead of being inert; rows
  with one use `projectPath(projectId)` (overview tab). It never marks anything read — App
  owns `useNotifications`, and no mutation callbacks are passed to Home.
* `ProjectsWidget` uses `readProjectTab` from `src/shell/projectTabPreference` (P2-b's note)
  and shows `status === "active"` projects only, most recently updated first.
* The greeting date uses `Intl.DateTimeFormat(undefined, { weekday, day, month })`, so the
  order is the viewer's locale (`Wednesday, September 2` in en-US); assert on parts.
* `.widget` is styled as a card in `home.css` instead of adding the `.card` class, because
  rows are full-bleed and `.card`'s 16px padding would inset them.
* Home renders no `.menu-toggle` (per P2-b, App floats it over `.app-main`); `.home-header`
  reserves `32px` of extra left padding below 900px so the toggle never covers the greeting.

**Classes added by `styles/home.css`** (nothing outside the file is redefined; the only rules
reaching into other packages' components are `.widget-footer .quick-add` — drops the inline
quick-add's border/padding inside the footer — and `.home-invitation-list .invitation-row` —
drops the row's horizontal padding inside the notice): `.home-header`, `.home-greeting`
(`-title`, `-meta`), `.home-summary`, `.home-invitations-title`, `.home-invitation-list`,
`.home-invitation-error`, `.home-grid`, `.home-column`, `.widget` (`-header`, `-title`,
`-actions`, `-body`, `-footer`, `-empty`, `-notice`, `-skeleton`, `-skeleton-mark`,
`-skeleton-line`), `.widget-row`, `.project-row` (`-color`, `-name`, `-meta`), `.inbox-row`
(`.is-unread`, `-dot`, `-main`, `-text`, `-meta`).

**Tests**: `src/pages/HomePage.test.jsx`, `src/home/{Widget,MyTasksWidget,AssignedWidget,
ProjectsWidget,InboxWidget}.test.jsx` and `src/home/homeData.test.js` — `createHookRuntime()`
for `react`, `vi.mock("../tasks")` stubbing `TaskRow`/`QuickAdd` as `() => null` and matching
the elements by their mocked type (no `render()` expansion, so the captured props survive).
`Widget`'s `actions` / `footer` are props, not children, so the helpers must be pointed at
`props(tree).actions` / `props(tree).footer` when looking for the header and quick-add
controls.

## P3-h settings

Owned files: `src/SettingsPage.jsx` (+test), `src/settings/*` (+tests), `src/styles/settings.css`.
`src/settings/BackgroundSettingsPanel.jsx` and its test are deleted. `App.jsx` needs no edit —
the component takes exactly the prop set P2-b already passes (no `homeRequest`, no list props).

* **Page shape.** `<section class="page settings-page" aria-label="Settings">` with
  `.page-header` and `.page-body.is-narrow`. When a detail panel is open the header shows a
  ghost `Back` button plus the panel title as `.page-title`; the overview shows `Settings`.
  `.settings-page .page-body` narrows the shared 1200px `is-narrow` cap to 720px.
* **`SettingsDetail` no longer renders a heading or a Back button** and no longer takes
  `onBack` — the page header owns both. Its `title` is only the region's `aria-label`, so
  every panel component (`ProfileSettingsPanel`, `ProjectRemindersPanel`,
  `ArchivedProjectsPanel`, `CalendarConnectionSection`) lost its `onBack` prop too.
  Panel titles live in the `panelTitles` map in `SettingsPage.jsx`; a new panel id must be
  added there or the header renders an empty title.
* **`SettingsControls` exports** are now exactly `SettingsGroup`, `SettingsRow`, `ToggleRow`,
  `SelectionRows`, `SettingsDetail`. `PlaceholderPanel` and `UnavailableProviders` are gone
  (their only callers were the removed panels). `SettingsRow` dropped the unused `selected`
  prop and gained `description`; `ToggleRow` dropped `status` and renders the `Checkbox`
  primitive with `className="switch"`.
* **Rows removed** per §6.7: Background, Default list, Import data, External suggestions,
  Reset filter suggestions, What's new. Also removed, as a deviation: the disabled
  **Time detection** placeholder inside Time settings (same "Not available" placeholder shape
  as External suggestions, which the spec does remove), and the **My Day** panel was collapsed
  to a single level — it now shows the reset-time options directly, because its other two rows
  were both on the removal list.
* **Deviation — data export kept.** The "Export TaskFlow data" button lived inside the removed
  Import data panel. It is now a plain `Export data` row in the Account group that downloads the
  same JSON, so the `exportData` prop keeps both of its uses (archived projects + export).
  Delete that one row if the export was meant to go with the panel.
* **`GoogleCalendarIntegrationPanel` is now the Google connection card** (status `Badge`,
  account/sync `dl`, Connect/Sync/Disconnect, its own `ConfirmDialog`) rendered inside
  `CalendarConnectionSection`. The old unreachable `integrations` panel id is gone; its props
  are now `{ connection, loading, pendingAction, error, message, syncSummary,
  confirmingDisconnect, onConnect, onSync, onRequestDisconnect, onCancelDisconnect,
  onDisconnect, onRetry }`.
* **Dialogs are primitives now.** The calendar setup modal is `Dialog` and both destructive
  confirmations (delete account, disconnect Google) are `ConfirmDialog`. `SettingsPage` no
  longer calls `useModalLifecycle` or passes a `dialogRef`/`onBackdropMouseDown`, so the setup
  modal now traps Tab and restores focus (it previously did neither). The close control is
  `Dialog`'s `aria-label="Close"` button, not the old "Close calendar connection setup".
* **`connectedCalendarCount`** on the Calendars row now counts the Google *service* connection
  (loaded when the Calendars panel opens) plus any connected non-Google provider in
  `settings.calendarConnections`; `calendarConnections.google` is no longer counted because the
  OAuth flow never writes it. The row therefore reads "Not connected" until the panel has been
  opened once in a session.
* **Copy** is sentence case throughout: `My Profile` → `Profile`, `Archived Tasks` →
  `Archived tasks`, `Default View` → `Default view`, `Create a New Project` → `New project`,
  `Calendar Settings` → `Calendars`, `Setup required` → `Set up`, archived-project `View` →
  `Open`, and the default-view option for `dashboard` is now labelled `Home`. All settings
  values (theme, week start, My Day) are humanized with a shared helper, and the My Day row
  shows the resolved reset time (`12:00 AM`) instead of the mode name.
* **CSS.** `styles/settings.css` is written from scratch: `.settings-page`, `.settings-account*`,
  `.settings-group(-title)`, `.settings-row*`, `.settings-detail*`, `.settings-form*`,
  `.settings-identity*`, `.settings-danger*`, `.settings-connection*`, `.settings-provider-row`,
  `.settings-requirements*`, `.settings-project-row`, `.settings-shortcut-row`, `.settings-about*`,
  `.settings-number-field`, `.settings-field-suffix`, `.settings-time-input`, `.settings-loading`,
  and the generic `.option-list` / `.option-row` / `.option-body` / `.option-check` selection list
  (usable by any package that needs radio rows). The only rule reaching into a primitive is
  `.checkbox.switch input`, which restyles the `Checkbox` input as a switch.
* **For P4:** `TASKFLOW_BACKGROUNDS` / `SETTINGS_BACKGROUND_IDS` and the `background` /
  `appearance` settings sections are no longer read by any UI, but `settingsDomain` still
  normalizes and validates them; retiring them is a domain decision outside this package.

## P3-d workspace

Owned files: `src/pages/ProjectWorkspacePage.jsx` (+test), `src/project/ProjectHeader.jsx`,
`ProjectBoardTab.jsx`, `ProjectListTab.jsx` (+tests), `src/styles/project-workspace.css`.
`App.jsx` needs no edit — the page takes exactly the prop set in §6.6/P3-d plus the
optional `workspaceLoader` (defaults to `consumeProjectWorkspace`, so P3-i can inject
fixtures). `onProjectTasksChanged()` fires after every successful create, quick update,
completion, move, archive, delete, story restore, assignee change and bulk update.

**Component contracts other packages may care about**

* **`ProjectHeader`** (default + named export) —
  `{ userId, project, members, stories, tab, onTabChange, canEdit, onNewTask, onNewStory,
  onUpdateProject, onDeleteProject, onBack }`. It owns the surfaces it opens:
  `ProjectMembersModal` (avatar stack + `Invite`/`Members` button), `ProjectDialog` in
  edit mode, and the delete `ConfirmDialog` (confirm → `onDeleteProject(id)` → `onBack()`).
  Archive/Restore call `onUpdateProject(id, { status })`. The overflow `Menu` shows
  `Copy link` to everyone and Edit/Archive/Delete to owners only. Failures from those
  three surface as a dismissible `InlineNotice` under the tab bar.
  **The page, not the header, renders `TaskComposerDialog`** (§6.6 assigns it to the page)
  so the list tab's QuickAdd "Add details" can reuse it; the header only calls
  `onNewTask()` / `onNewStory()`.
* **`ProjectBoardTab`** — `{ columns, tasks, context, onMove, onOpen, onQuickCreate,
  readOnly, selectedTaskId, selectable, selectedIds, allSelected, onToggleSelect,
  onToggleAll, bulkBusy, bulkMessage, members, stories, currentStoryId, onBulkAction,
  onClearSelection, todayKey }`.
* **`ProjectListTab`** — same bulk props plus `{ tasks, stories, members, columns, context,
  group, onOpen, onToggleComplete, onArchive, onCreate(title, sectionDefaults),
  onOpenComposer(initialValues), readOnly, pendingIds, hasTasks, onClearFilters }`.
  `sectionDefaults` is one of `{ storyId }`, `{ column }` (the column object, so
  `statusForColumn` stays in the page) or `{ assigneeId }`; the page turns it into the
  create payload and calls `setTaskAssignee` after the create when an assignee is set.
* Class names added by `project-workspace.css`: `.workspace`, `.workspace-head`,
  `.workspace-header`, `.workspace-identity`, `.workspace-color`, `.workspace-name`,
  `.workspace-description`, `.workspace-members`, `.workspace-tabbar`,
  `.workspace-head-notice`, `.workspace-toolbar`, `.workspace-content` (`.is-board`),
  `.workspace-loading`, `.workspace-bulk`, `.workspace-bulk-all`, `.workspace-bulk-message`,
  `.workspace-board`, `.workspace-list`, `.workspace-section`, `.workspace-section-empty`.
  Two rules reach outside the file: `.workspace-header { border-bottom: 0 }` (the border
  moves to `.workspace-tabbar`) and `.workspace-board .task-board { flex: 1; height: auto }`
  (tasks.css gives `.task-board` `height: 100%`, which overflows inside a flex column).
  P3-e appends its `/* Overview & Stories tabs */` block at the end of the file.

**Deviations from the spec / old page, with reasons**

* `formatSettings` is **not destructured** by the page: no component in `src/tasks`
  accepts it any more (P2-a dropped it), and an unused parameter fails `oxlint`. App can
  keep passing it.
* The List **Status filter is `Any / To do / In progress / Done`** (§6.6) instead of the
  old `All / Active / Completed`, and it only applies on the List tab. Sorting moved to
  `sortTasks` (`created | due | priority`) and search to `taskSearchMatch`, which also
  matches project and story names (the old page matched title/description/notes only).
* The **List "No story" section is now always rendered** (with `No tasks` when empty),
  as are the per-story/status/assignee sections; the old page dropped empty sections.
  Section headers collapse via an `IconButton` and keep their count.
* `panelNotice` is gone. It only ever carried `TaskEditModal`'s attachment notice, and
  `TaskDetailPanel.onClose()` takes no argument.
* The old **Attachments view** (a 4th `project-attachments-view` tab) is gone; §1 defines
  four tabs and attachments live in the detail panel's Attachments tab.
* Board quick-add has no "Add details" affordance because `TaskBoard`/`BoardColumn`
  (P2-a) do not pass `onOpenDetails` to `QuickAdd`. The **List** quick-add does, through
  `onOpenComposer`, so the old "hand the typed title to the full form" flow survives there.
* Copy: story/no-story strings are sentence case now (`No story`,
  "Move linked tasks to No story before archiving this story.").
* Archiving from a `TaskRow` menu is wrapped so a rejection becomes the page's
  `.page-notice` instead of an unhandled rejection (the row menu does not await).
* `attachmentService.getTaskCounts` now has a `.catch(() => {})`; it was a bare `void`
  promise before.

**For P4 / others**

* Old files this replaces (delete in P4): `src/ProjectTasksPage.jsx` +
  `src/ProjectTasksPage.test.jsx`, and with them `ProjectBoard`, `ProjectColumn`,
  `ProjectTaskCard`, `ProjectTaskQuickCreate`, `StoryBulkActionBar`, `StoryOverviewPanel`.
* `ProjectDialog`, `ProjectOverviewTab` and `ProjectStoriesTab` are imported by path
  (`../projects/ProjectDialog`, `../project/ProjectOverviewTab`,
  `../project/ProjectStoriesTab`) against the §6.5/§6.6 contracts; my tests mock them, so
  the workspace tests pass before P3-c/P3-e land.

**⚠️ Correction — P3-e's CSS block was overwritten and rebuilt**

`src/styles/project-workspace.css` was still the one-line placeholder when I read it, so my
`Write` of the whole file landed on top of P3-e's
`/* ===== Overview & Stories tabs (P3-e) ===== */` block (P3-e had appended it moments
earlier). Their block is **not recoverable** — the file is untracked, so there is no git
copy — and P3-e's session had already ended, so I rebuilt it at the end of the file from
their integration note's class list and the markup in `ProjectOverviewTab.jsx` /
`ProjectStoriesTab.jsx`. It is marked with a comment pointing here.

Every class P3-e listed is covered (`.overview-tab`, `.overview-stats` with `.stat`,
`.stat-value`, `.stat-label`, `.is-danger`, `.overview-grid`,
`.overview-skeleton-value/-line`, `.bar-row`, `.bar-label`, `.bar-value`,
`.bar-row .progress-fill.is-todo/.is-progress/.is-done`,
`.overview-task-list/-row/-title/-assignee/-date` with `.is-overdue`,
`.overview-description`, `.about-row`, `.about-label`, `.overview-health-select`,
`.overview-health-note`, `.overview-member`, `.stories-tab`, `.story-row` with
`.is-selected`/`.is-archived` and `-icon/-main/-title/-description/-meta/-progress/-bar/
-count/-chevron`, `.archived-stories`), and `.story-row-bar` only adds the 80px width on
top of `tasks.css`'s `.progress` as P2-a asked. **P4 (or P3-e, if it runs again) should
eyeball the two tabs** — the values are my reconstruction, not P3-e's originals, so
spacing/tone details may differ from what they intended. No P3-e JS/JSX was touched.

## P4 integration

Final wiring pass. Only the deltas other agents would not expect are listed; everything
else in this file still holds.

**`formatSettings` is a real prop again (§5.2).** P2-a had dropped it, so
`CalendarPage` and `CalendarAgendaView` were spreading `formatSettings` onto the
`.task-row` `div` through `...rest` — an unknown DOM attribute in every calendar list.

* `TaskRow` and `TaskCard` now take `formatSettings = {}` and use it: the due `<time>`
  gets a `title` with the absolute date from
  `formatDateOnlyForDisplay(dueDate, formatSettings.dateFormat)`. The visible label is
  still `formatDueLabel`, so no existing assertion moved.
* `TaskBoard` / `BoardColumn` accept `formatSettings` and pass it to their cards;
  `TaskDetailPanel` accepts it and passes it to the related-task rows;
  `TaskComposerDialog` accepts it for its time chip (below).
* Pages that already received `formatSettings` from `App` now forward it:
  `MyTasksPage`, `ArchivedTasksPage`, `HomePage` (→ `MyTasksWidget` / `AssignedWidget`),
  `ProjectWorkspacePage` (→ board tab, list tab, detail panel, composer). The P3-a,
  P3-b and P3-d notes saying "accepted and dropped" are superseded.
* Audit result: every component that spreads `...rest` onto a DOM node
  (`TaskRow`, `TaskCard`, `TaskBoard`, `BoardColumn`, `QuickAdd`, `QuickAddTrigger`,
  `TaskFilterBar`, `BulkActionBar`, `StoryProgress`, `TaskProperties`, `TaskCheckbox`,
  `Widget`, every `src/ui` primitive) destructures every non-DOM prop its call sites
  pass. `context`, `todayKey`, `taskActions` and `formatSettings` can no longer reach
  the DOM.

**`TaskComposerDialog` carries the calendar schedule.** `EMPTY_VALUES` gained
`endDate`, `startTime` and `endTime`, so the `{ dueDate, endDate, startTime, endTime }`
that Week/Day views hand to `onNewTask` now survive into the submitted values (the loose
end flagged in the P3-f note). When `startTime` is set the body shows a read-only
`.composer-schedule` chip (`9:00 AM–10:00 AM`, formatted with `formatSettings.format`).
`App.jsx` now passes `formatSettings` to the composer as well.

**Board quick-add has "Add details".** `TaskBoard` and `BoardColumn` take an optional
`onOpenDetails(title, column)` and pass it to the column `QuickAdd`, so the board matches
the list. Wired by `MyTasksPage` (→ `onNewTask({ title, status: column.id })`) and by
`ProjectBoardTab`'s new `onOpenComposer` prop, which `ProjectWorkspacePage` fills with its
existing `openComposer` (it already turns `{ title, column }` into
`status: statusForColumn(column)`). This supersedes the P3-d deviation note.

**`CommentRow` no longer calls `window.confirm`.** Deleting a comment opens the
`ConfirmDialog` primitive (`danger`, confirm label `Delete`, title
`Delete this comment?`); `onDelete(comment.id)` is unchanged and the row still owns
`busy` and the inline error. `src/` now contains no `window.confirm` / `alert` / `prompt`.

**Consistency sweep**

* `ProjectHeader` renders the project name as `<h1 class="workspace-name">` (§6.6); it was
  a `span`, leaving the workspace as the only page without an `h1`.
* `ProjectWorkspacePage`'s three fallback states (projects loading, projects error, project
  not found) now render `.page-header` + `.page-body` like every other page instead of a
  bare body.
* `shell.css`'s mobile rule is `.app-main > .page .page-header` (descendant) so the
  workspace header, which sits inside `.workspace-head`, also clears the floating menu
  button.
* The two modal/drawer scrims moved into `tokens.css` as `--color-scrim` /
  `--color-scrim-strong` (same values, one place). The only remaining literal colors
  outside `tokens.css` are the two `#ffffff` foregrounds on filled marks (`.avatar`,
  `.task-check.is-complete`), the select-chevron data URI in `ui.css` (a data URI cannot
  read a custom property) and `ProjectDialog`'s project palette — all spec-sanctioned.
* CSS audit: every class selector in `src/styles/*.css` is reachable from a component
  (the apparent orphans are all built dynamically — `is-${tone}`, `badge-${tone}`,
  `quick-add-${variant}`, `props-chip-${row.id}`, …). `.overview-tab.is-loading` was the
  one class the overview skeleton rendered with no rule; it now has one.

**Deletions** (spec §10, all verified unimported first): `Dashboard`,
`DashboardInviteModal`, `GlobalTopNav`, `InboxPage`, `NotificationsPanel`, `PlanningPage`,
`WorkspacePage`, `TasksPage`, `TaskRow`, `TaskEditModal`, `TaskForm`, `TaskListsPanel`,
`ProjectBoard`, `ProjectColumn`, `ProjectTaskCard`, `ProjectTaskQuickCreate`,
`ProjectTasksPage`, `ProjectOverviewPage`, `ProjectsPage`, `StoryBulkActionBar`,
`StoryOverviewPanel`, `TaskAssigneeSelector` (all under `src/`), plus
`src/domain/planningDomain.js` and `src/domain/workspaceNavigationDomain.js` and every
matching `*.test.jsx`. `src/index.css` and `src/settings/BackgroundSettingsPanel.jsx` were
already gone. Kept per §10: `listService`, `listRepository`, `personalTaskBoardDomain`,
and the unused-but-domain modules `projectMemberDomain` / `taskDueDateDomain`.
`src/assets/{hero.png,react.svg,vite.svg}` are unreferenced but were left in place — they
are assets, not components, and nothing bundles them.

**Docs** — `README.md` gained a Routes table and lost the `/today` reference in the Vercel
section; `CHANGELOG.md` gained the `v2.0.0 — UI redesign` entry. `vercel.json` enumerates
no routes (one catch-all rewrite), so it needed no change.

## F3 wiring

Owned files: `src/App.jsx` (+test), `src/pages/{HomePage,MyTasksPage,CalendarPage,
ArchivedTasksPage}.jsx` (+tests), `src/home/{MyTasksWidget,AssignedWidget}.jsx` (+tests)
and `src/dev/*`. `src/project/*` and `ProjectWorkspacePage.jsx` needed no edit (see below).

**`App.jsx` — `openTaskInProject(task)`.** New handler next to `openProject`: it no-ops
for a personal task, otherwise clears `selectedTaskId` (closing the global panel), sets
`projectItemOpenRequest = { projectId, itemId: task.id, request: Date.now() }` and
navigates to `projectPath(projectId, readProjectTab(projectId))`, so the workspace opens
the same task on its remembered tab. It is passed as **`onOpenProject`** to `HomePage`,
`MyTasksPage`, `CalendarPage`, `ArchivedTasksPage` and `ConnectedTaskDetailPanel`.
`handleSearchSelect` now delegates to it instead of repeating the request/navigate pair
(the only behavior change there is that the global panel closes first).

**Pages forward `onOpenProject` verbatim** to every `TaskRow` / `TaskBoard` they render:
`HomePage` → `MyTasksWidget` + `AssignedWidget` → their rows; `MyTasksPage` → list rows
**and** the board; `ArchivedTasksPage` → its rows; `CalendarPage` → the month view's day
agenda rows, `undefined` for Google events (they have no project, and the row already
drops `onToggleComplete` for them). **Nothing inside the project workspace passes it** —
`ProjectWorkspacePage`, `ProjectBoardTab` and `ProjectListTab` are unchanged, since the
viewer is already in the project.

* **Still missing (for P2-a/P4 or whoever owns `src/calendar/*`):** `CalendarAgendaView`,
  `CalendarWeekView` and `CalendarDayView` render their own `TaskRow`s and do not take
  `onOpenProject`, so Week/Day/Agenda rows have no "go to project" affordance yet.
  `CalendarPage` already holds the handler; forwarding it is a one-line change in each of
  the three views plus the page.

**Preview harness (`src/dev/*`) — three fixes.**

* **Every sidebar project now opens** (feedback 4b). Root cause: `PreviewApp.navigate`
  only read the *tab* out of `/projects/:id/:tab` and always rendered `PREVIEW_PROJECT`,
  and the `Sidebar` was handed a constant `selectedProjectId`, so clicking any project
  but the first looked inert. There is now a `previewProjectId` state; `navigate` parses
  the id with `projectIdFromPath` / `projectTabFromPath` and `openProjectWorkspace(id,
  tab)` falls back to the first fixture project for an unknown id (e.g. the invitation's
  `project-nebula`). The `workspace-*` screens, the Overview `ProjectHeader`, the sidebar
  highlight and `ProjectsPage.onOpenProject` all follow it, and `ProjectWorkspacePage` is
  keyed by project id so a switch remounts cleanly.
* **Theme follows the settings** (feedback 6). Root cause: `PreviewApp` wrote
  `document.documentElement.dataset.theme` from its own `theme` state, so saving Theme in
  the Settings screen changed `state.settings` and nothing else. The document theme is now
  derived from `state.settings.theme.mode` through `resolveThemeMode` (same effect shape as
  `App.jsx`, which was already correct and is untouched); the index Light/Dark button and
  `?theme=dark` both write that field, and the URL param is kept in sync from it.
* **`onOpenProject` is wired like `App.jsx`**: `openTaskInProject` sets a preview-level
  `projectItemOpenRequest`, switches to that project's workspace screen and hands the
  request to `ProjectWorkspacePage` as `openItemRequest`, so the workspace opens its own
  panel on the task. `TaskDetailPanel` in the harness gets the `() => void` form.
* **Fixtures**: `src/dev/fixtures.js` gained six tasks for Orbit and Atlas
  (`otherProjectTasks`) so those two workspaces have a populated board and list. They are
  deliberately **not** in the exported `tasks` array — that array stands in for App's
  personal ∪ assigned-to-me list, and unassigned project work does not belong there.
  `createPreviewWorkspaceLoader` already filtered by `projectId` and already returned the
  shared `members` / `columns` for any project, so it needed no change.

**Tests**: `App.test.jsx` gained a "go to project" describe (panel → request + navigation
to the remembered tab; the handler reaching My Tasks, Calendar and Archived; a personal
task navigating nowhere). Page and widget tests assert the prop is forwarded to the row /
board. `src/dev/*` stays untested by design — it was verified by serving the app
(`npx vite --port 5199`) and curling `/src/dev/PreviewApp.jsx`, `/src/App.jsx` and the
edited pages for 200s.

## F1 task panel

`TaskDetailPanel` is now a 560px detail surface with a project/story breadcrumb, a visible
auto-growing title and description, a compact two-column property grid when the panel is
at least 520px wide, and separate Attachments and Activity sections. The old three-pill
tab bar is gone; Activity uses a small `Comments | All` text switch. Personal tasks stop
after Description. The project crumb becomes a button only when `onOpenProject` is wired,
and `ConnectedTaskDetailPanel` binds the current task into that callback.

The missing project-task title was CSS shrinkage, not bad task data: the panel body's flex
items were allowed to collapse when collaboration content overflowed. Direct children no
longer shrink, and both textareas also auto-grow from `scrollHeight`. Re-seeding now always
resets dirty state when the task id changes while preserving an in-progress field across a
refresh of the same task. Tests cover initial project titles, task switches, dirty refreshes
and the project crumb contract.

`TaskComments` and `ActivityFeed` show a failed live subscription as a muted informational
line instead of a full notice. Attachment count propagation now preserves
`(entityId, count)`, matching `ProjectWorkspacePage`'s cache callback.

## F2 rows & cards

`TaskRow`, `TaskCard` and `TaskBoard` accept `onOpenProject(task)`. A linked project's badge
is a propagation-safe button when the callback exists and remains presentational otherwise.
`TaskBoard` passes the callback through its columns to every card. The calendar Agenda view
also forwards the handler to task rows (and deliberately omits it for Google events),
resolving the F3 handoff note above; Week and Day events open the same detail panel, whose
project crumb provides the project action.

The whole `TaskCard` article is now mouse- and keyboard-activatable (Enter/Space), while
bulk selection and project-badge controls remain isolated from open/drag behavior. Task
rows establish an inline-size container and switch to a two-line title/badge/meta layout
below 460px, with bounded badge overflow and no colliding metadata. Filter chips and their
labels no longer shrink or wrap. The desktop menu toggle now wins over the generic `.btn`
display rule in both `ui.css` and `shell.css`, with the mobile override restored below
900px.

## F4 project overview cleanup

Removed the four headline statistic cards (Total, Completed, In progress and Overdue) from
`ProjectOverviewTab`, including their loading placeholders and now-unused responsive CSS.
The overview begins directly with its two-column content grid; the Status card retains the
total count and distribution, while Overdue tasks retains the actionable overdue count.

## F5 compact task collaboration

The task panel's lower section is intentionally denser. `AttachmentSection compact` owns
its heading, count and Upload action in one toolbar; an empty editable section renders one
40px drop target and omits the duplicate illustrated empty state. Once files exist, the
drop target disappears and the compact file list starts directly below the toolbar.

`TaskComments compact` replaces its illustrated empty state with a muted line. The composer
starts as a one-line, auto-growing input, moves member shortcuts into a `Mention` menu, and
only reveals the character counter near the 4,000-character limit. `ActivityFeed compact`
uses the same quiet empty-state treatment and limits the All feed to eight entries.

## F6 narrow calendar row correction

The task row itself now permits wrapping at every width, with a 4px row gap. Its existing
460px container query can therefore move metadata onto a second line. A container cannot
apply its own container-query rule to itself, so the previous `.task-row { flex-wrap:
wrap }` inside that query never matched; the metadata's 100% basis instead squeezed the
title column to zero and painted the due date over it in the calendar day agenda.

The shared `.tab` primitive now explicitly resets its background to transparent. Without
that reset, the browser's native button face showed through as four large gray blocks in
dark mode; project tabs are once again quiet text/icon controls with the accent underline
as the selected-state treatment.
