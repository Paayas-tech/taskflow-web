# Package P3-c — Projects list + ProjectDialog

You own `src/pages/ProjectsPage.jsx` (+test), `src/projects/ProjectDialog.jsx` (+test),
`src/styles/projects.css`. Nothing else. Do not delete old files.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §3 (project palette), §4, §6.5 (your deliverable),
§11, §12. Then `src/ui/index.js` + primitives, `src/collaboration/InvitationRow.jsx`,
`src/application/projectWorkspaceLoader.js` (`prefetchProjectWorkspace`), old
`src/ProjectsPage.jsx` + `src/ProjectsPage.test.jsx` (port behaviors: create/edit/delete,
archive toggle, invitation accept/decline with busy state, filters, error handling).

## Props (exact — App passes these)
```
{ userId, projects, loading, error, onRetry, onCreateProject(data) → Promise<id>,
  onUpdateProject(id, data), onDeleteProject(id), onOpenProject(id), createRequest,
  invitations, invitationsLoading, invitationsError, onRetryInvitations,
  onAcceptInvitation(id), onDeclineInvitation(id) }
```
`createRequest` is a counter: when it changes to a non-zero value, open the create dialog.

## Build
- Page header per §6.5 (title with count of visible projects; `SegmentedControl`
  All/Mine/Shared; `Show archived` checkbox chip; search `Input`; `New project` primary).
  Mine = `viewerRole === 'owner' || ownerId === userId`.
- Invitations section with `InvitationRow incoming` rows and per-row busy.
- `.row-list` of `.project-row` per §6.5; `Menu` per row (Open, Edit, Archive/Restore,
  Delete — Edit/Archive/Delete only when owner); Delete → `ConfirmDialog danger`. Row click
  → `onOpenProject(id)`; `onMouseEnter` → `prefetchProjectWorkspace(userId, id)?.catch(()=>{})`.
- `ProjectDialog` per §6.5 (create + edit modes; name required; description ≤ 1000 with
  counter; 8 color swatches as `role="radiogroup"` buttons with `aria-checked`; footer
  Cancel / Create project | Save; `busy` disables; `error` shown via `InlineNotice`).
- Loading skeleton rows; error notice with Retry; empty state per §6.5; "No matching
  projects" muted line when filters hide everything.

## Tests
Repo style; assert filters, owner-only menu items, dialog open on `createRequest`, submit
payload `{ name, description, color }`, edit prefill, delete confirmation → `onDeleteProject`,
invitation actions, prefetch on hover.

## Verify
`npx vitest run src/pages/ProjectsPage.test.jsx src/projects/ProjectDialog.test.jsx` passes;
`npx oxlint` clean. No build.
