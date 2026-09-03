# TaskFlow UI Redesign — Design Specification

This document is the single source of truth for the 2026-09 UI refactor. Implementation
agents must follow it exactly: file locations, component names, prop contracts, class
names, and visual tokens. Where this spec is silent, prefer the simplest option that
matches Linear/Asana conventions and the principles below.

The app: a project-management + personal task tool. Personal tasks and project tasks
interoperate (project tasks assigned to you appear in My Tasks, Home, and Calendar).
Projects have members (owner / editor / viewer), a Kanban board, a task list, and
Stories (task groups, like Jira epics-lite). Tasks have title, description, status,
priority, due date, assignee, story, comments, activity, attachments, reminders.

---

## 0. Principles

1. **Minimal and calm.** White content surface, light-gray sidebar, one accent color,
   thin 1px borders instead of shadows. No gradients, no decorative backgrounds, no
   animated backgrounds.
2. **Hierarchy through type and spacing, not boxes.** One page title per page (20px
   semibold). Section titles 14px semibold. Body 14px. Meta 12–13px muted.
3. **Fewer clicks.** Creating a task is one click + typing (inline quick-add) or one
   dialog with everything on a single screen. Task details open in a side panel without
   leaving the page. Fields in the detail panel auto-save.
4. **Consistency.** Every list of tasks uses the same `TaskRow`. Every board uses the same
   `TaskBoard`. Every task detail uses the same `TaskDetailPanel`. Every create flow uses
   `QuickAdd` (inline) or `TaskComposerDialog` (full).
5. **Don't add features.** Reorganize and polish what exists. Remove redundant surfaces
   (For you / Recent / Starred / Planning views, settings sheet, notifications popover,
   top nav bar, personal lists UI, decorative backgrounds).
6. **Accessible.** Keyboard operable, focus-visible rings, `aria-*` on interactive
   controls, semantic headings, `role="dialog"` for dialogs, `aria-live` for status.
7. **Keep the data/domain/infrastructure layers intact.** `src/application/*`,
   `src/domain/*`, `src/infrastructure/*`, `src/services/*` are only changed where this
   spec explicitly says so.

---

## 1. Information architecture & routes

| Route | View id | Page component | Notes |
|---|---|---|---|
| `/` | `home` | `src/pages/HomePage.jsx` | Dashboard with widgets |
| `/tasks` | `tasks` | `src/pages/MyTasksPage.jsx` | Personal + assigned project tasks; List / Board |
| `/calendar` | `calendar` | `src/pages/CalendarPage.jsx` | Month / Week / Day / Agenda |
| `/inbox` | `inbox` | `src/pages/InboxPage.jsx` | Notifications |
| `/projects` | `projects` | `src/pages/ProjectsPage.jsx` | Project list + invitations |
| `/projects/:id` | `project` (tab `overview`) | `src/pages/ProjectWorkspacePage.jsx` | Redirect target for bare project path |
| `/projects/:id/overview` | `project` | same | Overview tab |
| `/projects/:id/board` | `project` | same | Board tab |
| `/projects/:id/list` | `project` | same | List tab |
| `/projects/:id/stories` | `project` | same | Stories tab |
| `/settings` | `settings` | `src/SettingsPage.jsx` (existing, restyled) | Full page, no sheet |
| `/archived-tasks` | `archived` | `src/pages/ArchivedTasksPage.jsx` | Linked from Settings |
| `/recover` | `recover` | existing `Recover.jsx` | Unchanged flow |

Removed routes (normalize to `/`): `/for-you`, `/recent`, `/starred`, `/planning/*`,
`/plans`, `/today`. `normalizePath` must map `/projects/:id` → `/projects/:id/overview`
and any unknown project sub-path → `/projects/:id/overview`.

`appRoutes.js` exports (rewrite): `navigationItems` (Home, My Tasks, Calendar, Inbox,
Projects — in that order — each `{ label, path, icon }`), `routeViews`,
`projectIdFromPath(pathname)`, `projectTabFromPath(pathname)` →
`'overview'|'board'|'list'|'stories'`, `projectPath(id, tab='overview')`,
`normalizePath`, `routeViewFromPath`, `isNavigationItemActive(itemPath, currentPath,
currentView)`, `pageTitle(view, selectedProject)` (document title only).

Persisted UI preferences (localStorage, all wrapped in try/catch):
`taskflow:sidebar-collapsed`, `taskflow:my-tasks-view` (`list|board`),
`taskflow:project-tab:<projectId>` (last tab; sidebar project links open it),
`taskflow:my-tasks-group` (`due|priority|project|status`).

`settings.navigation.defaultView` values stay `dashboard|tasks|projects|calendar|last-viewed`;
`allowedViewPaths` in `settingsDomain.js` becomes `/`, `/tasks`, `/calendar`, `/inbox`,
`/projects` (remove the deleted paths). Update its tests.

---

## 2. Layout & shell

```
┌────────────┬──────────────────────────────────────────────┐
│  Sidebar   │  Page                                        │
│  240px     │  ┌─ page-header (title · tabs · actions) ─┐  │
│  (56px     │  │                                         │  │
│  collapsed)│  └─ page-body ──────────────────────────────┘  │
│            │                                   [side panel]│
└────────────┴──────────────────────────────────────────────┘
```

* `.app-shell` = CSS grid, columns `var(--sidebar-w) minmax(0, 1fr)`; `--sidebar-w: 240px`,
  `56px` when `.app-shell.is-collapsed`. Height 100vh; the page scrolls, not the body.
* **No global top bar.** Search and create live in the sidebar. Notifications live in Inbox.
* **Sidebar** (`src/shell/Sidebar.jsx`, bg `--color-bg`, right border):
  1. Brand row: `TaskFlow` wordmark (13px semibold, letter-spacing -0.01em) with a small
     accent check mark; right: collapse toggle icon button (`panel-left` icon).
  2. `New task` primary button (full width, 32px) — opens `TaskComposerDialog`.
     Below it a `Search` ghost row (search icon, "Search", kbd `⌘K`) — opens `SearchDialog`.
  3. Primary nav: Home, My Tasks, Calendar, Inbox (badge with unread count if > 0),
     Projects (badge with pending invitation count if > 0). Each item: 32px tall, 8px
     radius, icon 16px + label 14px, active = `--color-surface-3` fill + `--color-text`.
  4. Section header `Projects` (11px uppercase muted, letter-spacing .06em) with a `+`
     icon button on the right (new project). Beneath: active projects (color square 8px
     + name, truncated). Active project row highlighted. Empty: muted "No projects yet".
  5. Footer (pinned bottom): Settings item (gear) and a user row (avatar + display name,
     truncated) that opens `UserMenu` (Profile, Settings, Sign out). Sign-out errors show
     as a small `role="alert"` under the user row.
  Collapsed mode: icons only, tooltips via `title`, brand shows the mark only, project
  list hidden, user row shows the avatar only.
  Mobile (< 900px): sidebar becomes an off-canvas drawer toggled by a floating menu
  button in the page header (`.page-header .menu-toggle`, hidden on desktop).
* **Page header** (`.page-header`): 52px tall, bottom border, horizontal padding 24px.
  Left: `.page-title` (h1, 18px/600, optional leading icon or project color square).
  Center/right: optional `Tabs`. Right: `.page-actions` (buttons).
* **Page body** (`.page-body`): padding 24px; max-width 1200px for list pages
  (`.page-body.is-narrow`), full width for boards/calendar.
* **Side panel** (`.side-panel`, `src/ui/SidePanel.jsx`): fixed, right 0, top 0, height
  100vh, width 440px (100vw on mobile), bg surface, left border, `--shadow-lg`. No
  backdrop; the page behind stays interactive. Esc closes. Clicking another task while
  open swaps the content.

---

## 3. Design tokens — `src/styles/tokens.css`

Define on `:root` (light) and override on `:root[data-theme="dark"]`. Remove all
`data-background` styling and the animated backgrounds.

```css
:root {
  color-scheme: light;
  --font-sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  --text-xs: 11px; --text-sm: 12px; --text-md: 13px; --text-base: 14px;
  --text-lg: 16px; --text-xl: 18px; --text-2xl: 22px;
  --leading: 1.5;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-full: 999px;
  --control-h: 32px; --control-h-sm: 28px; --control-h-lg: 36px;
  --sidebar-w: 240px; --sidebar-w-collapsed: 56px; --panel-w: 440px;

  --color-bg: #f7f7f8;
  --color-surface: #ffffff;
  --color-surface-2: #f3f3f5;
  --color-surface-3: #e9e9ed;
  --color-border: #e4e4e9;
  --color-border-strong: #d0d0d8;
  --color-text: #1c1c21;
  --color-text-2: #5c5c6b;
  --color-text-3: #8b8b99;
  --color-text-inverse: #ffffff;

  --color-accent: #5b5bd6;
  --color-accent-hover: #4b4bc6;
  --color-accent-soft: #eeeefb;
  --color-accent-text: #4646b4;

  --color-success: #1f9d64; --color-success-soft: #e6f6ee;
  --color-warning: #d68a0c; --color-warning-soft: #fdf3df;
  --color-danger: #d5484a;  --color-danger-soft: #fbe9e9;
  --color-info: #2f7fe0;    --color-info-soft: #e8f1fc;

  --status-todo: #a3a3af;
  --status-progress: #d68a0c;
  --status-done: #1f9d64;
  --priority-high: #d5484a; --priority-medium: #d68a0c; --priority-low: #a3a3af;

  --shadow-sm: 0 1px 2px rgba(16, 16, 24, 0.06);
  --shadow-md: 0 4px 16px rgba(16, 16, 24, 0.08);
  --shadow-lg: 0 8px 32px rgba(16, 16, 24, 0.14);
  --focus-ring: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent);
  --transition: 120ms ease;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #15151a; --color-surface: #1b1b21; --color-surface-2: #22222a;
  --color-surface-3: #2a2a33; --color-border: #2c2c36; --color-border-strong: #3b3b47;
  --color-text: #ececf1; --color-text-2: #a6a6b4; --color-text-3: #76767f;
  --color-text-inverse: #15151a;
  --color-accent: #7c7cec; --color-accent-hover: #8f8ff1; --color-accent-soft: #2a2a48;
  --color-accent-text: #a5a5f5;
  --color-success: #3ab77d; --color-success-soft: #173427;
  --color-warning: #e0a03a; --color-warning-soft: #3a2d15;
  --color-danger: #e5686a; --color-danger-soft: #3f2224;
  --color-info: #5b9cf0; --color-info-soft: #1b2c44;
  --status-todo: #6f6f7c; --status-progress: #e0a03a; --status-done: #3ab77d;
  --priority-high: #e5686a; --priority-medium: #e0a03a; --priority-low: #6f6f7c;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.4); --shadow-md: 0 4px 16px rgba(0,0,0,.45);
  --shadow-lg: 0 8px 32px rgba(0,0,0,.6);
}
```

Project colors palette (used by project color picker and defaults):
`#5b5bd6 #1f9d64 #d5484a #d68a0c #2f7fe0 #8e44ad #0e9aa7 #6b7280`. Legacy colors from the
old palette (`#6657c8 #4f8a68 #ad5c74 #b77a24 #64748b`) must still render (just use the
stored hex).

`src/styles/base.css`: reset (box-sizing, margins), `html, body { background: var(--color-bg); color: var(--color-text); font: var(--text-base)/var(--leading) var(--font-sans); }`,
`button, input, select, textarea { font: inherit; color: inherit; }`, focus-visible rule
`:focus-visible { outline: none; box-shadow: var(--focus-ring); }` (inputs use a border
color change + ring), `.sr-only`, scrollbars thin (`scrollbar-width: thin`), `@media
(prefers-reduced-motion: reduce)` disables transitions.

CSS conventions: plain class names, kebab-case, component root class + descendant
classes (`.task-row`, `.task-row-title`). State classes `is-*` (`is-active`,
`is-complete`, `is-selected`, `is-overdue`). Variant classes `btn-primary`. No IDs for
styling. No `!important`. Each CSS file starts with a comment naming the components it
styles. **Every CSS rule must be used by a component that exists after the refactor** —
no dead CSS.

`src/App.css` becomes only `@import` lines (in this order): `styles/tokens.css`,
`styles/base.css`, `styles/ui.css`, `styles/shell.css`, `styles/tasks.css`,
`styles/task-panel.css`, `styles/home.css`, `styles/projects.css`,
`styles/project-workspace.css`, `styles/calendar.css`, `styles/inbox.css`,
`styles/settings.css`, `styles/auth.css`, `styles/collaboration.css`. Each package owns
exactly one of these files (see §11). `src/index.css` is deleted (its reset moves to
`base.css`; `main.jsx` imports only `App.css` via `App.jsx`).

---

## 4. UI primitives — `src/ui/`

All primitives are plain function components (no default export of hooks). Class names
are exact. Every component forwards `className` and `...rest` to its root element unless
noted. Tests: render as functions and assert on the returned element tree (repo
convention, see §12).

| Component | File | Props | Root class / notes |
|---|---|---|---|
| `Button` | `Button.jsx` | `variant='secondary'|'primary'|'ghost'|'danger'`, `size='md'|'sm'`, `icon` (node, leading), `loading`, `type='button'`, `children` | `.btn .btn-{variant} [.btn-sm] [.is-loading]`; when `loading`, render `<Spinner size="sm"/>` before children and set `aria-busy` + `disabled` |
| `IconButton` | `Button.jsx` (named export) | `label` (required → `aria-label` and `title`), `size`, `variant='ghost'|'secondary'`, `children` (icon) | `.btn .btn-icon .btn-{variant} [.btn-sm]` |
| `Avatar` | `Avatar.jsx` | `name`, `size='sm'|'md'|'lg'` (20/24/32px), `src` (optional image) | `.avatar .avatar-{size}`; initials (first letters of first two words, uppercase); background color from `avatarColor(name)` (deterministic hash over 8 hues); `title={name}` |
| `AvatarStack` | `Avatar.jsx` (named) | `people=[{name,src}]`, `max=3`, `size` | `.avatar-stack`, overflow `+N` chip |
| `Badge` | `Badge.jsx` | `tone='neutral'|'accent'|'success'|'warning'|'danger'|'info'`, `dot` (bool, leading dot), `children` | `.badge .badge-{tone}`; 11px/500, 2px 6px padding, radius-full |
| `Tabs` | `Tabs.jsx` | `items=[{id,label,count?,icon?}]`, `value`, `onChange(id)`, `ariaLabel` | `<nav class="tabs" role="tablist">` with `<button role="tab" class="tab [is-active]" aria-selected>`; underline 2px accent on active; counts as `.tab-count` |
| `SegmentedControl` | `SegmentedControl.jsx` | `options=[{id,label,icon?}]`, `value`, `onChange`, `ariaLabel`, `size` | `.segmented > button.segmented-option[.is-active]` pill group with surface-2 bg |
| `Menu` | `Menu.jsx` | `trigger` (render prop `(props) => node` receiving `{ref, onClick, 'aria-expanded', 'aria-haspopup'}`), `items=[{id,label,icon?,danger?,disabled?,onSelect} | {separator:true} | {label, heading:true}]`, `align='start'|'end'` | `.menu-wrap` > trigger + `.menu[role=menu]` with `.menu-item[role=menuitem] [.is-danger]`, `.menu-separator`, `.menu-heading`. Closes on Esc, outside mousedown, item select. Arrow keys move focus. |
| `Popover` (hook) | `usePopover.js` | `usePopover()` → `{ open, setOpen, toggle, close, rootRef }` with outside-click + Esc handling | used by Menu, SearchDialog, pickers |
| `Dialog` | `Dialog.jsx` | `open`, `onClose`, `title`, `description?`, `size='sm'|'md'|'lg'` (420/560/720px), `initialFocusRef?`, `busy`, `children`, `footer?` | `.dialog-backdrop` > `.dialog[role=dialog aria-modal]` > `.dialog-header (h2 .dialog-title, close IconButton)`, `.dialog-body`, `.dialog-footer`. Uses `useModalLifecycle` from `src/components/modal/useModalLifecycle.js` (keep that file). |
| `ConfirmDialog` | `Dialog.jsx` (named) | `open, onCancel, onConfirm, title, description, confirmLabel, danger, busy` | `role="alertdialog"`, `.dialog.dialog-confirm` |
| `SidePanel` | `SidePanel.jsx` | `open`, `onClose`, `ariaLabel`, `header` (node), `children`, `footer?`, `width` | `<aside class="side-panel" role="complementary">` with `.side-panel-header`, `.side-panel-body` (scroll), `.side-panel-footer`. Esc closes (unless a dialog is open above). |
| `Field` | `Field.jsx` | `label`, `hint?`, `error?`, `htmlFor`, `inline?`, `children` | `.field [.field-inline]` > `.field-label`, control, `.field-hint`, `.field-error[role=alert]` |
| `Input`, `Textarea`, `Select` | `Field.jsx` (named) | native props; `invalid` bool | `.input`, `.textarea`, `.select` (custom chevron via background-image, `appearance:none`) — height `--control-h`, radius-sm, border, focus ring |
| `Checkbox` | `Field.jsx` (named) | native props + `label` | `.checkbox` label wrapper |
| `EmptyState` | `EmptyState.jsx` | `icon?`, `title`, `description?`, `action?` (node) | `.empty-state` centered, muted, 32px padding |
| `Spinner` | `Spinner.jsx` | `size='sm'|'md'` | `.spinner` CSS ring, `role="status"`, `aria-label="Loading"` |
| `InlineNotice` | `InlineNotice.jsx` | `tone='error'|'success'|'info'`, `children`, `onDismiss?`, `action?` | `.notice .notice-{tone}` `role=alert|status` |
| `Kbd` | `Kbd.jsx` | children | `.kbd` |
| `Tooltip` | — | Not built; use `title=` attributes. | |

`src/ui/icons.jsx`: `export function Icon({ name, size = 16, ...rest })` rendering an
inline SVG (`viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, `stroke-width 1.75`,
round caps/joins, `aria-hidden="true"`). Provide these names (Lucide-style geometry):
`home, check-square, checklist, calendar, inbox, folder, folders, plus, search, settings,
chevron-down, chevron-right, chevron-left, chevron-up, more-horizontal, more-vertical,
flag, user, users, layout-board, list, book (story), archive, archive-restore, trash, x,
bell, filter, arrow-up-down (sort), clock, paperclip, message-circle, activity, check,
circle, circle-dot, circle-check, panel-left, panel-right, external-link, log-out, edit,
copy, calendar-plus, alert-circle, info, sun, moon, layers, tag, grip-vertical, refresh,
arrow-left, arrow-right, mail, star, eye, link`.
Export also `StatusIcon({ status })` (`todo` → empty circle in `--status-todo`;
`in-progress` → half-filled circle in `--status-progress`; `completed` → filled circle
with check in `--status-done`) and `PriorityIcon({ priority })` (three-bar signal glyph:
low = 1 bar muted, medium = 2 bars warning, high = 3 bars danger; `title`
"High priority" etc.).

`src/ui/index.js` re-exports everything.

`src/styles/ui.css` styles all primitives plus these shared layout classes:
`.page`, `.page-header`, `.page-title`, `.page-actions`, `.page-body`, `.is-narrow`,
`.toolbar` (flex row, 8px gap, wraps), `.toolbar-spacer`, `.section` / `.section-header`
/ `.section-title` (14px/600) / `.section-meta`, `.row-list` (bordered rounded container
whose children rows have top borders), `.card` (surface, border, radius-md, 16px pad),
`.muted`, `.truncate`, `.stack-2/-3/-4` (vertical gaps), `.cluster-2/-3` (horizontal),
`.divider`.

---

## 5. Shared task components — `src/tasks/`

### 5.1 Data shape
Tasks come from `normalizeTaskDocument` (see `src/domain/taskDomain.js`) plus optional
project extras: `assigneeId`, `assigneeName`, `projectName` (assigned-task loads),
`projectStatus`, `columnId`, `position`, `storyName` (computed in workspace),
`attachmentCount`. `workType` is `'task'|'story'`. Personal tasks have `projectId: null`.

`src/tasks/taskPresentation.js` (pure helpers, tested):
- `statusLabel(status)` → `To do | In progress | Done`.
- `priorityLabel(priority)` → `Low | Medium | High`.
- `dueDateTone(dueDate, todayKey, completed)` → `'overdue'|'today'|'soon'|'later'|'none'`
  (`soon` = within 7 days).
- `formatDueLabel(dueDate, todayKey)` → `Today`, `Tomorrow`, `Yesterday`, `Mon 12 Aug`-style
  (`Intl.DateTimeFormat(undefined,{weekday:'short', day:'numeric', month:'short'})`, add
  year when not current year), `''` for none.
- `groupTasksByDue(tasks, todayKey)` → ordered array of `{ id, label, tasks }` for
  `overdue, today, upcoming (next 7 days), later, none`; excludes completed; plus
  `completed` group last (tasks completed, newest completedAt first). Empty groups
  omitted except `today` (always shown, so the page never looks broken).
- `groupTasksBy(tasks, key, context)` for `priority | project | status | story | assignee`.
- `sortTasks(tasks, sort)` for `due | priority | created | title | updated`.
- `taskSearchMatch(task, query)`.

### 5.2 Components

**`TaskCheckbox`** (`TaskCheckbox.jsx`): `{ checked, onChange, disabled, busy, label,
size='md' }` → `<button type="button" role="checkbox" aria-checked class="task-check
[is-complete] [is-busy]">`; 16px circle, 1.5px border `--color-border-strong`, hover
shows a faint check, complete = `--status-done` fill with white check. Busy = spinner.

**`TaskRow`** (`TaskRow.jsx`): the one row used everywhere.
```
{ task, context, selected, onOpen(task, triggerEl), onToggleComplete(task),
  onArchive?(task), onRestore?(task), onDeletePermanently?(task), busy, readOnly,
  showProject=true, showStory=true, showAssignee=true, dense=false, todayKey,
  selectable=false, selectedForBulk=false, onToggleSelect?(taskId), formatSettings }
```
`context = { projectsById: Map, membersById?: Map }` (for badges).
Structure: `<div class="task-row [is-selected] [is-complete] [is-dense]" role="button"
tabIndex=0>` (click/Enter/Space → `onOpen`; interactive children stop propagation):
`[bulk Checkbox]` `[TaskCheckbox]` `.task-row-main` (`.task-row-title` 14px, then
`.task-row-badges`: project badge (color dot + name) when `showProject && task.projectId`,
story badge (`book` icon + storyName) when present) then `.task-row-meta` right side:
attachment count (paperclip + n) if > 0, comments not shown, due `.task-due.is-{tone}`
(calendar icon + label; overdue red, today accent, soon default, later muted),
`PriorityIcon` (only when priority !== 'medium' or `dense === false`), `Avatar sm` for
assignee when `showAssignee && task.assigneeId`, and a trailing `Menu` (more-horizontal
ghost icon button, visible on hover/focus) with `Open`, `Archive` (if `onArchive`),
`Restore` (if `onRestore`), `Delete permanently` (if `onDeletePermanently`, danger).
Archived rows show `Badge neutral "Archived"` instead of the checkbox. Google calendar
events (`task.source === 'google'`) render a `G` badge and no checkbox.

**`QuickAdd`** (`QuickAdd.jsx`): inline create.
```
{ placeholder='Add a task…', onCreate(title) → Promise, onOpenDetails?(title), onCancel,
  autoFocus=true, contextLabel, variant='row'|'card' }
```
`<form class="quick-add quick-add-{variant}">`: a `TaskCheckbox`-like disabled circle,
text input (Enter submits, Esc cancels, Shift+Enter/“Add details” opens composer via
`onOpenDetails(currentTitle)`), `.quick-add-actions` with `Add` (primary sm) and
`Add details` (ghost sm) and `x` icon button. Clears and refocuses after success, keeps
open for rapid entry. Error shown inline (`.quick-add-error[role=alert]`).

**`QuickAddTrigger`** (in same file): `{ label='Add task', onClick }` → `.quick-add-trigger`
ghost row with `plus` icon, dashed top border on hover.

**`TaskBoard`** (`TaskBoard.jsx`), **`BoardColumn`**, **`TaskCard`** (`TaskCard.jsx`):
generic Kanban with `@dnd-kit` (keep `groupProjectTasksByColumn`,
`buildProjectTaskPlacements`, `taskIdFromProjectDnd`, `columnIdFromProjectDnd` from
`src/domain/projectBoardDomain.js`).
```
<TaskBoard columns=[{id,name,category}] tasks context onMove(placements) onOpen(task)
  onQuickCreate(title, column) → Promise readOnly collapsible initiallyCollapsedIds
  selectedTaskId selectable selectedIds onToggleSelect todayKey formatSettings />
```
Column: `<section class="board-column [is-over] [is-collapsed]">` header: `StatusIcon`
by category + name (13px/600) + count badge + `+` icon button; body `.board-column-list`
(scrolls vertically inside column; board scrolls horizontally); footer `QuickAddTrigger`
→ `QuickAdd variant="card"`. Column width 280px, gap 16px, bg `--color-surface-2`, radius-lg.
Card: `<article class="task-card [is-dragging] [is-selected]">` whole card draggable via
`useSortable` (no separate handle; pointer activation distance 6px); content: title
(14px/500, 2-line clamp), story badge, footer row: `PriorityIcon`, due label, spacer,
assignee `Avatar sm`. Click → `onOpen`. `DragOverlay` shows a tilted copy.

**`TaskFilterBar`** (`TaskFilterBar.jsx`): compact toolbar used by My Tasks and project
Board/List. Props: `{ search, onSearch, filters: [{ id, label, value, options:[{value,label}], onChange }],
sort?: {value, options, onChange}, group?: {value, options, onChange}, onClear, activeCount }`.
Renders a search `Input` (search icon, 220px), then each filter as a `Select` styled as
a chip (`.filter-select`, shows `Label: Value`, accent border when not default), sort
and group selects, and `Clear` ghost button when `activeCount > 0`.

**`TaskProperties`** (`TaskProperties.jsx`): the property grid shared by the detail panel
and composer.
```
{ values, onChange(name, value), disabled, mode='panel'|'composer',
  isStory, isPersonal, projects (editable, for personal → project move),
  projectMembers, projectStories, showReminder, browserNotificationsEnabled,
  defaultReminderMinutes, errors }
```
Rows (label 12px muted, 120px column; control on the right): Status (Select with
StatusIcon), Priority (Select with PriorityIcon), Due date (`input type=date` + clear x),
Assignee (Select with Avatar; project tasks only; `Unassigned` first), Story (Select;
project tasks only, not stories; `No story` first), Project (Select; personal tasks only;
`No project` first; changing moves the task), Reminder (personal, non-story only:
toggle `Checkbox` "Remind me" → when on, `Select` preset from
`src/domain/reminderDomain.js` presets + `datetime-local` input; keep existing
validation via `getReminderValidationError`).
In `composer` mode the same rows render as a wrapping chip row (`.props-chips`) instead
of a grid: each chip is the select styled as a pill with icon.

**`TaskDetailPanel`** (`TaskDetailPanel.jsx`): replaces `TaskEditModal`. Rendered inside
`SidePanel`. Auto-saves.
```
{ task, userId, project=null, projectMembers=[], projectStories=[], projectColumns=[],
  projects=[], readOnly=false,
  onUpdate(patch) → Promise, onToggleComplete() → Promise, onArchive?() → Promise,
  onRestore?() → Promise, onDelete?() → Promise, onSetAssignee?(assigneeId) → Promise,
  onClose(), returnFocusElement?,
  relatedTasks=[], onOpenRelatedTask?(task), onCreateRelatedTask?(title) → Promise,
  onBulkUpdateRelatedTasks?(taskIds, {type, value}) → Promise<{updated,failed,failedIds}>,
  archiveLinkedTaskCount=0, onAttachmentCountChange?, browserNotificationsEnabled,
  defaultReminderMinutes, formatSettings, todayKey }
```
Layout:
1. Header (`.side-panel-header`): breadcrumb text (`Project name › Story name` or
   `My tasks`), spacer, actions: `Mark complete` (secondary sm, becomes `Completed`
   success-tinted when done), `Archive`/`Restore` icon button, `Delete` icon button
   (opens `ConfirmDialog`), `x` close.
2. Title: `<textarea class="panel-title" rows=1>` auto-grow, 20px/600, saves on blur or
   Enter (Enter prevents newline), reverts on Esc. Empty title is not saved (shows error).
3. `TaskProperties mode="panel"`. Each change calls `onUpdate({field: value})`
   immediately (assignee uses `onSetAssignee`). While saving show `.panel-save-state`
   ("Saving…" / "Saved" fades after 1.5s / "Couldn't save" with Retry).
4. Description: `<textarea class="panel-description">` placeholder "Add a description…",
   auto-grow, saves on blur; 1000-char counter appears when > 900.
5. Stories only: `StoryProgress` block (`src/tasks/StoryProgress.jsx`: progress bar +
   `n/m done` + per-status counts) then `Tasks` section: `TaskRow dense` list of
   `relatedTasks` (click → `onOpenRelatedTask`), select-all checkbox + `BulkActionBar`
   (`src/tasks/BulkActionBar.jsx`: selected count, selects for status/priority/assignee/
   story, Clear) when `onBulkUpdateRelatedTasks`, and `QuickAddTrigger`/`QuickAdd`
   (`onCreateRelatedTask`) at the bottom.
6. Project tasks/stories only: `Tabs` `Comments | Activity | Attachments` (counts where
   available) rendering existing `TaskComments`, `ActivityFeed` (with `includeComments`
   false), `AttachmentSection` (`compact`). Personal tasks: no tabs (nothing to show).
7. `readOnly` (viewer): controls disabled, header actions hidden except close, a muted
   "View only" badge in the header.
Story archive with linked tasks: keep the existing confirmation flow ("Move linked
tasks to No story before archiving") via `ConfirmDialog`; call
`onArchive({ moveLinkedTasksToUncategorized: true })`.

**`ConnectedTaskDetailPanel`** (`ConnectedTaskDetailPanel.jsx`): wrapper for use outside
the project workspace. Props: `{ task, userId, projects, taskActions, onClose, ...passthrough }`.
If `task.projectId`, uses `useProjectContext(userId, task.projectId)` to load
`members`, `stories`, `columns`, `project` and passes them down; while loading, renders
the panel with empty lists (selects disabled). Maps `taskActions` (see §7.2) to the panel
callbacks. `readOnly` when the project's `viewerRole === 'viewer'`.

**`TaskComposerDialog`** (`TaskComposerDialog.jsx`): replaces the create modals.
```
{ open, onClose, onSubmit(values) → Promise<created?>, initialValues={},
  userId, projects=[] (editable), lockProject=false, projectContext?={members, stories},
  workType='task', browserNotificationsEnabled, defaultReminderMinutes }
```
`Dialog size="md" title={workType==='story' ? 'New story' : 'New task'}`. Body: title
`Input` (autofocus, placeholder "Task title"), description `Textarea` (2 rows,
auto-grow), `TaskProperties mode="composer"` chips (Project chip first when
`!lockProject`; when a project is chosen and no `projectContext` supplied, the composer
loads members/stories via `useProjectContext`). Footer: `Cancel` ghost, `Create task`
primary (disabled until title non-empty). ⌘/Ctrl+Enter submits. Error under footer.
`values` submitted: `{ title, description, status, priority, dueDate, projectId,
storyId, assigneeId, workType, reminder, reminderAt }` (empty strings for unset).

**`useProjectContext`** (`src/projects/useProjectContext.js`):
`useProjectContext(userId, projectId) → { project, tasks, stories, members, columns, loading, error, reload }`.
Loads via `getProjectTasks`, `getProjectColumns`, `getProjectMembers` from
`src/application/projectService.js` (Promise.all) — with a module-level cache
`Map<projectId, {promise, at}>` (60s TTL) and `invalidateProjectContext(projectId)`
export. `stories = tasks.filter(t => t.workType === 'story' && !isArchived(t))`.
Returns empty arrays when `projectId` is null.

---

## 6. Page specifications

### 6.1 Home — `src/pages/HomePage.jsx` (+ `src/home/*Widget.jsx`, `styles/home.css`)
Header: `.home-greeting` — `Good morning, Karthik` (22px/600) with the long date
underneath (13px muted) and a summary sentence: `3 due today · 1 overdue · 2 projects`
(only non-zero parts). Right: `New task` primary button.
Body: 2-column grid (`minmax(0,1fr) 360px`, single column < 1100px), 24px gap.
* **MyTasksWidget** (left, top): `.widget` card. Header: title `My tasks`, `SegmentedControl`
  `Today | Upcoming | Overdue` with counts, `View all` link → `/tasks`. Body: up to 6
  `TaskRow dense` (click → `onOpenTask`, checkbox → `taskActions.toggleComplete`).
  Footer: `QuickAdd` (variant row, creates a personal task; Today tab pre-fills dueDate =
  today; `Add details` → `onNewTask({title, dueDate})`). Empty tab: `EmptyState`
  "Nothing due today" etc. with the quick-add still available.
* **AssignedWidget** (left, bottom): `Assigned to me` — project tasks assigned to the
  user, incomplete, sorted by due; up to 6 `TaskRow dense showProject`. Empty: muted line
  "No project tasks are assigned to you."
* **ProjectsWidget** (right, top): `Projects` + `+` icon button (new project) + `View all`.
  Rows: color square, name, meta (`Owner` / `Editor` / `Viewer`); click → project (last
  tab). Up to 6. Empty: `EmptyState` with `Create a project` button.
* **InboxWidget** (right, bottom): `Inbox` + `Open inbox`. Up to 5 latest notifications
  (unread bold, dot) from props; click → `onNavigate` to project. Empty: "You're all caught up."
* **Invitations banner** (above grid, only when `invitations.length > 0`): `InlineNotice
  tone=info` "You have 2 project invitations" with Accept/Decline buttons per invitation
  (render `InvitationRow` list inside the notice).
* Loading: skeleton rows (`.skeleton` bars, `.skeleton-row`); errors per widget with Retry.

### 6.2 My Tasks — `src/pages/MyTasksPage.jsx` (`styles/tasks.css` shared with §5)
Header: title `My Tasks` (count of open tasks as `.page-title-count`), center
`SegmentedControl` `List | Board` (persisted), right `New task`.
Toolbar (`TaskFilterBar`): search; filters: `Source` (All / Personal / Projects),
`Priority` (Any / High / Medium / Low), `Project` (Any / each project), `Show completed`
toggle (checkbox chip); `Group by` (Due date · Priority · Project · Status — persisted);
`Sort` (Due · Priority · Created · Title).
List view: sections from `groupTasksByDue` (or `groupTasksBy` when grouping ≠ due).
Section header: label + count + collapse chevron (collapsed state in component state;
`Completed` collapsed by default). Rows: `TaskRow` (showProject when project task).
Under the `Today` section (or the first section when grouping ≠ due): a `QuickAddTrigger`
→ `QuickAdd` (creates personal task with `dueDate` = today when in Today section,
otherwise none; `Add details` → `onNewTask({title, dueDate})`).
Board view: `TaskBoard` with columns `[{id:'todo',name:'To do',category:'todo'},
{id:'in-progress',name:'In progress',category:'in_progress'},{id:'completed',name:'Done',
category:'done'}]`; task→column by status (use `mapPersonalTasksToBoard` /
`personalTaskMoveUpdate` from `src/domain/personalTaskBoardDomain.js` for personal tasks;
for project tasks moving columns → `taskActions.update(task, {status})`). Done column
collapsed initially.
Clicking a row → `onOpenTask(task)`; `selectedTaskId` highlights the row.
Loading → skeleton; error → `InlineNotice error` with Retry; empty (no tasks at all) →
`EmptyState icon=checklist title="No tasks yet" description="Add your first task."` with
a `QuickAdd`.

**Archived tasks** — `src/pages/ArchivedTasksPage.jsx` (restyle of existing): header
`Archived tasks` with `Back to settings` ghost button; body: `TaskRow` list with
`onRestore`, `onDeletePermanently`; empty state.

### 6.3 Calendar — `src/pages/CalendarPage.jsx` (`src/calendar/*`, `styles/calendar.css`)
Move existing `CalendarPage.jsx`, `CalendarWeekView.jsx`, `CalendarDayView.jsx`,
`CalendarAgendaView.jsx`, `CalendarEvent.jsx` into `src/calendar/` (page stays at
`src/pages/CalendarPage.jsx`). Keep the calendar domain logic. Restyle to tokens:
Header: title `Calendar`, center `SegmentedControl` `Month | Week | Day | Agenda`, right:
`Today` secondary button, `‹ ›` icon buttons, current range label (16px/600), `New task`.
Month grid: 7 columns, borders `--color-border`, day number 12px top-right, today = accent
circle; events as 1-line chips (`.cal-chip`, project color or accent left bar, strike-through
when complete; Google events with `G` prefix and info tone); `+N more` link opens the day.
Selected day agenda lives in a right column (320px) on month view: date title, `TaskRow
dense` list, `QuickAdd` (dueDate = selected day). Week/Day: keep time-grid components,
restyle. Agenda: grouped by date with `TaskRow dense`. Clicking a task → `onOpenTask`.
Props: `{ userId, tasks, externalEvents, tasksLoading, tasksError, onRetry, taskActions,
onOpenTask, selectedTaskId, onNewTask(initialValues), formatSettings, weekStartsOn, projects }`.
Remove the `embedded` prop and the compact variant (the calendar is no longer embedded).

### 6.4 Inbox — `src/pages/InboxPage.jsx` (`styles/inbox.css`)
Props: `{ notifications, loading, error, liveNotice, onMarkRead(id), onMarkAllRead(),
onDismiss(id), onRefresh(), onNavigate(path), onOpenSettings() }`.
Header: `Inbox` title, `Tabs` `All | Unread | Mentions` (counts), right: `Mark all read`
secondary, `Notification settings` ghost → `/settings`.
Body: `.row-list` of `.inbox-item [is-unread]`: type icon (assignment → `user`, comment
→ `message-circle`, mention → `@` glyph), text (`notificationLabel`), meta (type · time),
unread dot, dismiss `x` on hover. Click → mark read and `onNavigate(projectPath(...))`.
Empty: `EmptyState icon=inbox title="You're all caught up"`.
Keep `filterInboxNotifications` from `notificationDomain.js`; drop the Type/Sort selects.

### 6.5 Projects — `src/pages/ProjectsPage.jsx` (`src/projects/ProjectDialog.jsx`, `styles/projects.css`)
Header: `Projects` title (+count), right: filter `SegmentedControl` `All | Mine | Shared`,
`Show archived` checkbox chip, search `Input`, `New project` primary.
Invitations: when pending invitations exist, a `section` `Invitations` above the list
with `InvitationRow`s (Accept / Decline).
List: `.row-list` of `.project-row`: color square 12px, name (14px/500) + description
(13px muted, truncated), right: `Badge neutral` role (`Owner|Editor|Viewer`), `Archived`
badge when archived, `Updated 3 Sep`, `Menu` (Open, Edit, Archive/Restore, Delete —
Edit/Archive/Delete only for owners). Row click → `onOpenProject(id)`. Hover
prefetches via `prefetchProjectWorkspace`.
Empty: `EmptyState icon=folders title="No projects yet" description="Projects hold a board,
a task list and stories for your team." action=<Button primary>New project</Button>`.
**ProjectDialog** (`src/projects/ProjectDialog.jsx`): `{ open, onClose, onSubmit(values),
project? (edit mode), busy, error }` — `Dialog size="sm"`: Name `Input` (autofocus),
Description `Textarea`, Color swatches (8 palette colors, `role="radiogroup"`), footer
Cancel / `Create project` or `Save`. Deleting uses `ConfirmDialog` (danger).

### 6.6 Project workspace — `src/pages/ProjectWorkspacePage.jsx` (`src/project/*`, `styles/project-workspace.css`)
Owns: workspace load (`consumeProjectWorkspace` on mount/refresh, keep the request-id
guard pattern), tasks/columns/members state with optimistic updates (port the logic from
the old `ProjectTasksPage.jsx`: `handleQuickUpdate`, `handleMoveTasks`, `handleArchive`
story rules, `handleBulkStoryTaskUpdate`, `handleAssigneeChange`, `handleCreate`,
`handleQuickCreate`, `handleCreateStoryTask`, `handleRestoreStory`), filters, selected
item + story return stack, `TaskDetailPanel`, `TaskComposerDialog` (tasks and stories;
`lockProject`), `ProjectMembersModal` (existing, restyled), `ProjectDialog` for edit.
Props: `{ userId, projectId, project, projects, projectsLoading, projectsError,
onRetryProjects, tab, onTabChange(tab), openItemRequest, refreshToken,
onProjectTasksChanged(), onUpdateProject(id, data), onDeleteProject(id), onBack(),
formatSettings, browserNotificationsEnabled, defaultReminderMinutes }`.
Header (`src/project/ProjectHeader.jsx`): color square 14px + project name (h1) +
description (13px muted, 1 line, `title` = full), right: `AvatarStack` of members (click
→ members modal), `Members` secondary button (owners see `Invite`), `Menu` (Edit project,
Archive/Restore, Delete — owners only; `Copy link`). Below: `Tabs` `Overview | Board |
List | Stories` (Stories shows count). Right of tabs: `New task` primary (`New story`
on the Stories tab). Viewers: badge `View only` and no create buttons.
Filter bar (Board & List only, `TaskFilterBar`): search, `Story` (All / No story / each),
`Assignee` (Anyone / Unassigned / each member), `Status` (List only: Any / To do / In
progress / Done), List: `Group by` (Story · Status · Assignee · None), `Sort` (Created ·
Due · Priority). Board: `Show done` checkbox chip? — no: the board always shows all
columns.
* **Board tab** (`src/project/ProjectBoardTab.jsx`): `TaskBoard` with project columns;
  quick create per column → `handleQuickCreate(title, column)` (inherits story filter);
  bulk selection when a story filter is active (checkbox on cards) + `BulkActionBar`.
* **List tab** (`src/project/ProjectListTab.jsx`): sections by group; section header
  with count and collapse; `TaskRow` (showProject=false, showStory when not grouped by
  story); each section ends with `QuickAddTrigger`→`QuickAdd` that creates in that
  section's story/status/assignee. Bulk selection as Board.
* **Stories tab** (`src/project/ProjectStoriesTab.jsx`): props `{ stories, tasks,
  members, columns, selectedStoryId, onOpenStory(story, el), onNewStory(), archivedStories,
  onRestoreStory(id), restoringId, readOnly }`. `.row-list` of `.story-row`: `book` icon,
  title (14px/500), description one-line muted, progress bar (`.progress` 80px) + `3/8`,
  status badge, due, assignee avatar, `›`. Empty: `EmptyState icon=book title="No stories
  yet" description="Stories group related tasks."` + `New story`. `details` "Archived
  stories (n)" list with Restore buttons at the bottom.
* **Overview tab** (`src/project/ProjectOverviewTab.jsx`): props `{ userId, projectId,
  project, onOpenTask(taskId), members }`. Loads via `projectOverviewService.load`
  (keep loading/error/health update logic from old `ProjectOverviewPage.jsx`). Layout:
  top row of 4 `.stat` cards (Total · Completed · In progress · Overdue; 22px numbers,
  overdue in danger when > 0); then two columns: left `Status` card (horizontal bars per
  status), `Overdue tasks` card (rows → `onOpenTask`), `Recently completed` card; right
  `About` card (description or "No description", `Health` select (owner/editor) or
  badge, due date, created), `Members` card (Avatar + name + role, up to 8, "Manage"
  link → members modal).
Opening a task: `TaskDetailPanel` with workspace data; stories open with related tasks;
`onOpenRelatedTask` pushes the story onto a return stack so closing a task returns to
its story. `openItemRequest` from App opens a specific item after load.
Read-only projects: all mutations hidden/disabled; `readOnly` passed down.

### 6.7 Settings — `src/SettingsPage.jsx` + `src/settings/*` (`styles/settings.css`)
Keep the existing information architecture (overview rows → detail panels) but restyle:
page header `Settings`; overview groups as `.settings-group` cards with `.settings-row`
(label, value muted, chevron). Remove: **Background** row/panel
(`BackgroundSettingsPanel.jsx` + test deleted; `backgroundLabel` props removed),
**Default List** row/panel (personal lists UI is retired; keep `taskDefaults` in the
domain), **Import Data**, **External Suggestions**, **Reset Filter Suggestions**, **What's
New**. Keep: Profile (display name, sign out, delete account), Archived Tasks link,
Project Reminders, Archived Projects, My Day reset, Calendars (Google integration),
Theme (Light/Dark), Desktop notifications toggle, Default view, Time settings, Language,
Keyboard shortcuts, About. Settings is a **route page only**: delete the settings
sheet (`.settings-sheet*`), and the `SettingsPage` no longer needs `homeRequest`
(keep `profileRequest` to open the Profile panel directly). The `defaultView` options
remove `today` alias handling only if tests still pass; otherwise leave the domain alone.

### 6.8 Auth screens — `Login.jsx`, `Onboarding.jsx`, `Recover.jsx` (`styles/auth.css`)
Move into `src/auth/`. Keep logic and copy; restyle: centered 400px card on
`--color-bg`, wordmark on top, 22px title, 13px muted subtitle, `Input`/`Button`
primitives, mode tabs as `SegmentedControl`, errors as `InlineNotice`. Onboarding choices
as `.choice-card` radios. Also `ConfigurationErrorScreen.jsx` → `src/auth/`.

### 6.9 Collaboration components (`styles/collaboration.css`)
Move `AttachmentSection`, `TaskComments`, `CommentRow`, `ActivityFeed`, `ActivityRow`,
`MemberRow`, `InvitationRow`, `ProjectMembersModal`, `ProfileCompletionPrompt` into
`src/collaboration/`. Keep component names, props and behavior (tests move with them).
Restyle: comments as a thread (`Avatar sm`, name 13px/600, time muted, body 14px),
composer `Textarea` + `Button primary sm "Comment"`, mention suggestions as `.menu`.
Activity rows: dot timeline, 13px text, muted time. Attachments: `.row-list` rows with
paperclip icon, name, size, uploader, `Menu` (Download/Delete), drop zone dashed border.
`ProjectMembersModal` → `Dialog size="md"` "Members": invite form row (email `Input`,
role `Select`, `Invite` button), member rows (`Avatar`, name, email, role `Select` for
owners, remove `IconButton`), pending invitations list with Cancel. `InvitationRow` →
row with project name, inviter, role badge, Accept (primary sm) / Decline (ghost sm).
`ProfileCompletionPrompt` → `InlineNotice tone=info` with `Set display name` + Dismiss.

---

## 7. App shell — `src/App.jsx`, `src/shell/*`, `src/app/appRoutes.js` (`styles/shell.css`)

### 7.1 Responsibilities kept in App.jsx
Auth state, settings load/save, theme (`data-theme` only; delete `data-background` and
`lang` effects except `lang` stays), tasks/projects/assigned tasks/invitations loading,
reminder scheduler + reminder toast (`.toast`), routing (`navigate`, popstate), and the
handlers below. Delete: lists loading and everything list-related (`loadLists`, list
handlers, default-list effect), dashboard view state props (`dashboardTaskView`, search,
chart/summary period), workspace navigation (recent/starred) and planning goals,
`settingsSheetOpen`, `GlobalTopNav`, `NotificationsPanel`, `DashboardInviteModal`,
`WorkspacePage`, `PlanningPage`. Remove `React` default import if unused.

### 7.2 `taskActions` object (built once per render with `useMemo`, passed to pages)
```js
taskActions = {
  pendingIds,                       // Set<taskId> with in-flight quick updates
  update(task, patch),              // project task → updateProjectTask(uid, task.projectId, task.id, patch)
                                    //   then loadAssignedProjectTasks() and bump projectTaskRefreshToken;
                                    // personal → updateTask(uid, task.id, patch) then loadTasks()
  quickUpdate(task, patch),         // personal: existing optimistic mutation queue (keep the logic);
                                    // project: optimistic patch into assignedProjectTasks state, call
                                    //   updateProjectTask, reload on error
  toggleComplete(task),             // quickUpdate with { completed, status, completedAt }
  archive(task), restore(task), remove(task),   // dispatch personal vs project (archiveProjectTask /
                                    //   deleteProjectTask; personal archiveTask/unarchiveTask/deleteTask)
  setAssignee(task, assigneeId),    // project only → setTaskAssignee, then loadAssignedProjectTasks()
  createPersonal(values),           // createTask(uid, {...defaults, ...values, projectId:null}) → loadTasks()
  createInProject(projectId, values)// createProjectTask + optional setTaskAssignee → loadAssignedProjectTasks()
                                    //   + bump projectTaskRefreshToken; returns {id}
}
```
`myTasks` (memo): active personal tasks (not archived) ∪ `assignedProjectTasks` where
`workType !== 'story'` and not archived, deduped by id. Passed to Home, My Tasks, Calendar.

**Change in `src/domain/assignmentDomain.js`**: `sortAssignedTasksForAttention(tasks,
todayKey, { includeCompleted = false } = {})` — when `includeCompleted`, completed tasks
are kept and appended after open tasks sorted by `completedAt` desc. `projectService
.getAssignedProjectTasks` passes `{ includeCompleted: true }`. Update tests; Home's
Assigned widget and the sidebar counts filter out completed tasks themselves.

### 7.3 Global UI owned by App
* `selectedTask` state `{ id }` for non-project views; `ConnectedTaskDetailPanel` rendered
  when set and `currentView !== 'project'`; `task = myTasks.find(...)`; closes
  automatically when the task disappears.
* `composer` state `{ open, initialValues, workType }` → `TaskComposerDialog` rendered by
  App for Home / My Tasks / Calendar / Inbox / Projects (`onSubmit` → `values.projectId ?
  taskActions.createInProject : taskActions.createPersonal`). The project workspace
  renders its own composer.
* `SearchDialog` (`src/shell/SearchDialog.jsx`): `Dialog size="md"` without title; an
  `Input` with search icon (autofocus) and a results list (`.search-result`: icon by type
  — folder / check-square / book; title; subtitle project name). Items: projects, my tasks,
  assigned stories. Up/Down/Enter keyboard navigation. Selecting a project → navigate;
  a task → project task opens the workspace with `openItemRequest`, personal task opens
  the panel (`selectedTask`). Global shortcut `⌘K`/`Ctrl+K` and `/` (when not typing).
* `UserMenu` (`src/shell/UserMenu.jsx`): `Menu` with Profile (→ `/settings` +
  `profileRequest`), Settings, separator, Sign out (busy label while pending).
* `useNotifications(userId)` (`src/inbox/useNotifications.js`): extracted from the old
  `NotificationsPanel`/`InboxPage` — returns `{ notifications, loading, error, liveNotice,
  unreadCount, markRead(id), markAllRead(), dismiss(id), refresh() }`, subscribes once.
  App calls it once and passes results to Sidebar (badge), Home (widget) and Inbox.
* `ProfileCompletionPrompt` rendered at top of the page area (all views) as before.
* Reminder toast: `.toast` bottom-right, surface, border, shadow-md, `role=status`.

### 7.4 Sidebar props
```
<Sidebar collapsed onToggleCollapsed currentPath currentView projects selectedProjectId
  unreadCount invitationCount onNavigate(path) onNewTask() onNewProject() onOpenSearch()
  user={{ displayName, email }} onOpenProfile onOpenSettings onSignOut signOutPending
  signOutError mobileOpen onMobileClose />
```

---

## 8. Interaction details

* **Creating a task** — three entry points, all one screen: (1) inline `QuickAdd` in any
  task list/board column (Enter creates, stays open); (2) `New task` button →
  `TaskComposerDialog` (title + description + property chips, ⌘Enter creates);
  (3) `Add details` from a QuickAdd hands the typed title to the composer.
* **Editing** — open the row → side panel; every field auto-saves; title/description on
  blur. No Save button anywhere in the panel.
* **Completing** — the circle checkbox on rows/cards; optimistic; row gets strike-through
  title and muted color; in due-grouped lists the row moves to `Completed` on the next
  data refresh (do not animate).
* **Selecting** — row highlight `is-selected` while its panel is open.
* **Keyboard** — `⌘K` search, `/` search, `Esc` closes panel/dialog/menu, `Enter` opens a
  focused row, `Space` toggles completion on a focused checkbox.
* **Empty states** — always give the next action (a button or a QuickAdd).
* **Loading** — skeletons for lists (3 rows), `Spinner` inside buttons, never full-page
  spinners except the initial auth `.loading-screen`.
* **Errors** — `InlineNotice tone=error` with Retry where a load failed; mutation
  failures show a dismissible notice at the top of the page body (`.page-notice`).

---

## 9. Dev preview harness (visual QA without a backend) — `src/dev/`
`src/main.jsx`: when `import.meta.env.DEV && window.location.pathname === '/__preview'`,
`import('./dev/PreviewApp.jsx')` and render it instead of `App`. `PreviewApp.jsx` renders
the real `AppShell`-like layout (Sidebar with fixtures) and a left index of screens:
Home, My Tasks (list/board), Calendar, Inbox, Projects, Project workspace (each tab, with
the workspace page fed by a `loadWorkspace` override — add an optional prop
`workspaceLoader` to `ProjectWorkspacePage` defaulting to `consumeProjectWorkspace`),
Task panel (task / story / read-only), Composer, Settings, Login, Onboarding, Dialogs.
`src/dev/fixtures.js` exports realistic data: 3 projects, 2 stories, ~14 tasks (mix of
personal/project, priorities, due dates incl. overdue/today/soon, some completed,
assignees), 3 members, 4 notifications, 1 invitation. `taskActions` fixture functions
resolve after 300ms and mutate local state so interactions can be exercised. Provide a
`?theme=dark` toggle. This code is excluded from production by the `import.meta.env.DEV`
guard (dynamic import).

---

## 10. Files to delete (with their tests)
`src/GlobalTopNav.jsx`, `src/NotificationsPanel.jsx`, `src/WorkspacePage.jsx`,
`src/PlanningPage.jsx`, `src/domain/planningDomain.js`,
`src/domain/workspaceNavigationDomain.js`, `src/Dashboard.jsx`, `src/DashboardInviteModal.jsx`,
`src/TasksPage.jsx`, `src/TaskEditModal.jsx`, `src/TaskForm.jsx`, `src/TaskRow.jsx`,
`src/TaskListsPanel.jsx`, `src/ProjectBoard.jsx`, `src/ProjectColumn.jsx`,
`src/ProjectTaskCard.jsx`, `src/ProjectTaskQuickCreate.jsx`, `src/StoryBulkActionBar.jsx`,
`src/StoryOverviewPanel.jsx`, `src/TaskAssigneeSelector.jsx`, `src/ProjectTasksPage.jsx`,
`src/ProjectOverviewPage.jsx`, `src/ProjectsPage.jsx` (replaced under `src/pages/`),
`src/InboxPage.jsx` (replaced), `src/CalendarPage.jsx` (moved), `src/ArchivedTasksPage.jsx`
(moved), `src/settings/BackgroundSettingsPanel.jsx`, `src/index.css`, and all of the old
`src/App.css` content. `src/application/listService.js`, `src/infrastructure/supabase/
listRepository.js` and `src/domain/personalTaskBoardDomain.js` stay (services untouched;
the board domain is reused). `CollaborationIdentity.test.jsx` is updated to import the
moved components.

---

## 11. Work packages & ownership (parallel agents must stay inside their files)

| Package | Owns (create/modify) | CSS file |
|---|---|---|
| **P1 foundation** | `src/styles/tokens.css`, `base.css`, `ui.css`; `src/ui/*`; `src/App.css` (imports); delete `src/index.css` (update `main.jsx`) | `ui.css` |
| **P2-a task-core** | `src/tasks/*`, `src/projects/useProjectContext.js` | `tasks.css`, `task-panel.css` |
| **P2-b shell** | `src/App.jsx`, `src/App.test.jsx`, `src/app/appRoutes.js`(+test), `src/shell/*`, `src/inbox/useNotifications.js`, `src/domain/assignmentDomain.js`(+test), `src/domain/settingsDomain.js` allowedViewPaths (+test), `src/application/projectService.js` (includeCompleted), `src/main.jsx` preview hook, deletions in §10 that no other package replaces | `shell.css` |
| **P2-c auth** | `src/auth/*` (moved Login/Onboarding/Recover/ConfigurationErrorScreen + tests) | `auth.css` |
| **P2-d collaboration** | `src/collaboration/*` (moved + restyled components + tests) | `collaboration.css` |
| **P3-a home** | `src/pages/HomePage.jsx`, `src/home/*` (+tests) | `home.css` |
| **P3-b my-tasks** | `src/pages/MyTasksPage.jsx`, `src/pages/ArchivedTasksPage.jsx` (+tests) | (adds to `tasks.css` only via a clearly delimited `/* My Tasks page */` block at the end) |
| **P3-c projects** | `src/pages/ProjectsPage.jsx`, `src/projects/ProjectDialog.jsx` (+tests) | `projects.css` |
| **P3-d workspace** | `src/pages/ProjectWorkspacePage.jsx`, `src/project/ProjectHeader.jsx`, `ProjectBoardTab.jsx`, `ProjectListTab.jsx` (+tests) | `project-workspace.css` |
| **P3-e overview+stories** | `src/project/ProjectOverviewTab.jsx`, `src/project/ProjectStoriesTab.jsx` (+tests) | (adds a delimited `/* Overview & Stories tabs */` block at the end of `project-workspace.css`) |
| **P3-f calendar** | `src/pages/CalendarPage.jsx`, `src/calendar/*` (+tests) | `calendar.css` |
| **P3-g inbox** | `src/pages/InboxPage.jsx` (+test) | `inbox.css` |
| **P3-h settings** | `src/SettingsPage.jsx`, `src/settings/*` (+tests) | `settings.css` |
| **P3-i preview** | `src/dev/*` | none (uses existing) |
| **P4 integration** | anything, to make `npm test`, `npm run lint`, `npm run build` pass and wire loose ends | any |

Rules for every package:
0. **Only P4 deletes old files.** Until then old components stay on disk (unimported) so
   parallel packages can read them for reference and the test suite stays runnable.
1. Read this spec and the primitives in `src/ui/` before writing. Use primitives; do not
   hand-roll buttons/inputs/menus.
2. Do not edit files owned by another package. If you need a change there, write it
   down in `docs/ui-redesign/INTEGRATION_NOTES.md` under a heading with your package
   name (append-only) and code against the documented contract.
3. Keep application/domain/infrastructure layers unchanged except where §7.2 says.
4. Every new component gets a test in the repo style (§12). Delete tests of deleted code.
5. Run `npx vitest run <your files>` and `npx oxlint` before finishing. Do not run
   `npm run build` unless you own P4 (other packages may be mid-flight).
6. No new npm dependencies.
7. Copy is sentence case, short, no exclamation marks. Buttons are verbs.

---

## 12. Testing conventions
Vitest, no DOM library. Tests call components as plain functions with React hooks mocked
(`vi.mock("react", ...)` with a small hook runtime — copy the `hookRuntime` pattern from
`src/App.test.jsx` or the simpler `useState: (v) => [v, vi.fn()]` pattern from
`src/TaskRow.test.jsx`) and inspect the returned element tree with small helpers
(`textContent(node)`, `find(node, predicate)`, `findAll`). Put shared helpers in
`src/test/elementTree.js` (P1 creates it: `textContent`, `find`, `findAll`,
`findByText`, `findByRole`, `props(node)`; each walks `node.props.children`, arrays, and
also calls function components it encounters **only when** the helper `render(node)` is
used — provide `render(node, depth=6)` that expands nested function components so
compositions of primitives can be asserted). Services are mocked with `vi.mock` of
`../application/...` modules. Aim for behavior assertions (labels, aria attributes,
callbacks invoked with the right arguments), not snapshots.

---

## 13. Visual reference summary (what "done" looks like)
* Sidebar: light gray, 240px, wordmark, New task button, Search row, five nav items,
  Projects list, Settings + user at bottom.
* Home: greeting, summary line, four widgets with real rows, quick add in My tasks.
* My Tasks: List/Board toggle, filter bar, due-date sections, inline add, side panel.
* Projects: clean rows, role badges, one menu per row.
* Project: header with members, four tabs, filter bar; Board with clean cards; List
  grouped by story with inline add; Stories with progress bars; Overview with stats.
* Task panel: title, properties grid, description, comments/activity/attachments tabs.
* Everything else (settings, inbox, calendar, auth) uses the same tokens and primitives.
