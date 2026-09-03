# Fix package F2 — rows, cards, filter bar, shell CSS

You own: `src/tasks/TaskRow.jsx` (+test), `src/tasks/TaskCard.jsx` (+test),
`src/tasks/TaskBoard.jsx` (+test; pass-through only), `src/tasks/TaskFilterBar.jsx` (+test),
`src/styles/tasks.css`, `src/styles/ui.css`, `src/styles/shell.css`, `src/styles/calendar.css`
(the `.cal-agenda-entry` rules only). Nothing else.

## User feedback being addressed
1. A mobile menu-toggle button shows on desktop and overlaps the Home title (and does
   nothing there).
2. Text overlaps in task rows in the calendar's agenda column (narrow container): the title
   disappears, the project badge and the due/priority/avatar meta collide.
3. The "Group by:" label in the filter bar wraps onto two lines.
4. Clicking a board card only opens the task when the exact title is clicked — anywhere on
   the card must open it.
5. Personal tasks linked to a project need a way to jump to the project.

## Fixes
1. **Menu toggle**: `ui.css` line ~64 has `.menu-toggle { display: none }` but `.btn`
   (same specificity, later or earlier in the cascade) wins. Make the desktop rule win with
   `.btn.menu-toggle, .menu-toggle { display: none }` (and the ≥/< 900px media rule
   `.btn.menu-toggle { display: inline-flex }` inside the mobile block). Verify `.app-menu-toggle`
   in shell.css is also hidden on desktop. Nothing else should change.
2. **TaskRow overflow**: make the row robust in narrow containers.
   - `.task-row { container-type: inline-size; }`
   - `.task-row-main { flex: 1 1 auto; min-width: 0; display: flex; align-items: center;
     gap: var(--space-2); flex-wrap: nowrap; }`, `.task-row-title { flex: 1 1 auto;
     min-width: 60px; }` (keeps `truncate`), `.task-row-badges { flex: 0 1 auto; min-width: 0;
     overflow: hidden; }`, `.task-badge { max-width: 160px; overflow: hidden; text-overflow:
     ellipsis; white-space: nowrap; }`.
   - `.task-row-meta { flex: none; }` stays, but under `@container (max-width: 460px)` the
     row switches to a two-line layout: `.task-row { flex-wrap: wrap; }`, `.task-row-main {
     flex-basis: calc(100% - 40px); }`, `.task-row-meta { flex-basis: 100%; padding-left:
     28px; justify-content: flex-start; }` (adjust the padding to line up under the title),
     and `.task-row-badges` moves under the title as well (`.task-row-main { flex-wrap:
     wrap }` inside the container query, title `flex-basis: 100%`).
   - Nothing may ever overlap: audit `position: absolute` usage in `.task-row*` and remove it
     except for the hover menu if it is positioned. Test the agenda column
     (`.cal-agenda-entry > .task-row` in calendar.css must keep `flex: 1; min-width: 0`).
3. **Filter label**: `.filter-select-label { white-space: nowrap; flex: none; }` and
   `.filter-select { flex: none; }`.
4. **Card click**: in `TaskCard.jsx` move the open handler to the `<article>` (`role="button"`,
   `tabIndex={0}`, `aria-label` = task title, Enter/Space open) and turn the inner `<button>`
   into a `<div class="task-card-body">`. Keep `useSortable` `attributes`/`listeners` on the
   article; dnd-kit's 6px activation distance means a plain click still fires `onClick`. The
   bulk checkbox and any menu inside stop propagation (existing `stopPointer`/`stopKeys`).
   Cursor: `grab` on hover only when not read-only; `pointer` otherwise. Update the tests
   (click anywhere on the article calls `onOpen(task, article)`).
5. **onOpenProject**: `TaskRow`, `TaskCard` and `TaskBoard` (pass-through to cards) accept
   `onOpenProject?: (task) => void`. When provided and `task.projectId` is set, the project
   badge renders as `<button type="button" class="task-badge task-badge-project is-link"
   title="Open project">` that stops propagation and calls `onOpenProject(task)`; otherwise
   it stays a span. Style `.task-badge.is-link:hover { text-decoration: underline; color:
   var(--color-text); }`. Tests: badge is a button only with the prop; clicking it calls
   `onOpenProject` and does not call `onOpen`.

## Verify
`npx vitest run src/tasks` passes; `npx oxlint` clean. Do not run `npm run build`. Append
notes to `docs/ui-redesign/INTEGRATION_NOTES.md` under `## F2 rows & cards`.
