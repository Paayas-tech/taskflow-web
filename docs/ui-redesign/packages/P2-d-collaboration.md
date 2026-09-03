# Package P2-d — collaboration components

You own `src/collaboration/*` (already moved here: `AttachmentSection`, `TaskComments`,
`CommentRow`, `ActivityFeed`, `ActivityRow`, `MemberRow`, `InvitationRow`,
`ProjectMembersModal`, `ProfileCompletionPrompt`, their tests, and
`CollaborationIdentity.test.jsx`) and `src/styles/collaboration.css`. Nothing else.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §3, §4, §6.9, §11, §12; `src/ui/index.js` and the
primitives (`Dialog`, `Menu`, `Avatar`, `Button`, `Field`, `InlineNotice`, `EmptyState`,
`Spinner`, `Badge`, `Icon`); each component and its test.

## Deliverables
Restyle every component with primitives/tokens, keeping **component names, default exports,
props, service calls, aria labels, and text that tests assert on**. Other packages import
these components by name and pass the same props as today — do not change the contracts.
Specifically:
- `TaskComments`: thread layout (`.comment-thread`, `.comment` with `Avatar sm`, author
  13px/600, time muted, body 14px, edit/delete via `Menu` on hover for the author),
  composer at the bottom (`Textarea` auto-grow + `Button primary sm` "Comment", mention
  suggestions rendered with `.menu`/`.menu-item` classes). Keep mention logic.
- `ActivityFeed` / `ActivityRow`: `.activity-list` with dot timeline (`.activity-dot`),
  13px text, muted time; refresh notice via `InlineNotice`.
- `AttachmentSection`: `.attachment-list` rows (paperclip icon, name, size, uploader, date,
  `Menu` with Download/Delete), dashed drop zone `.attachment-dropzone` (when `allowDrop`),
  `Button secondary sm` "Upload" with hidden file input, progress/errors via `InlineNotice`,
  delete confirmation via `ConfirmDialog`. `compact` prop = tighter spacing, no heading.
- `ProjectMembersModal`: use `Dialog size="md" title="Members"`; invite form row (email
  `Input`, role `Select`, `Button primary` "Invite" — owners only); member rows via
  `MemberRow` (Avatar, name, email muted, role `Select` for owners else `Badge`, remove
  `IconButton trash` for owners, remove confirmation via `ConfirmDialog`); pending
  invitations via `InvitationRow` (Cancel button). Keep the focus/keyboard behaviors that the
  tests cover (the Dialog primitive handles trap/escape; delete the hand-rolled key handling
  if the tests still pass).
- `InvitationRow`: one row: project name 14px/500, "Invited by X · Editor" muted, actions
  Accept (`primary sm`) / Decline (`ghost sm`) when `incoming`, Cancel when not.
- `MemberRow`: as above.
- `ProfileCompletionPrompt`: `InlineNotice tone="info"` with text, `Set display name`
  (`Button primary sm`) and `Dismiss` (`ghost sm`).
- `CommentRow`: used by TaskComments/ActivityFeed — same restyle.

Write `src/styles/collaboration.css` from scratch (old rules are gone). Update tests only
as needed; keep behavior assertions (`CollaborationIdentity.test.jsx` asserts that raw user
IDs never render — keep that true). Note: `CollaborationIdentity.test.jsx` imports
`../TaskAssigneeSelector`, which is being replaced; remove that import and its assertions
from this test (the replacement `TaskProperties` is tested by package P2-a).

## Verify
`npx vitest run src/collaboration` passes; `npx oxlint` clean. Do not run `npm run build`.
