# Package P3-h — Settings

You own `src/SettingsPage.jsx` (+test), `src/settings/*` (+tests), `src/styles/settings.css`.
Nothing else. Do not delete old files EXCEPT `src/settings/BackgroundSettingsPanel.jsx` and
its test, which are yours to remove.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §2, §4, §6.7 (your deliverable), §11, §12. Then
`src/ui/*`, `src/SettingsPage.jsx`, everything in `src/settings/`, `src/SettingsPage.test.jsx`,
`src/settings/settingsSections.test.jsx`, `src/domain/settingsDomain.js`.

## Props (App passes these — unchanged from today except the removals)
```
{ settings, loading, error, saving, saveMessage, onRetry, onChange, onSave, onCommit,
  onSignOut, onDeleteAccount, deleteAccountPending, deleteAccountError, signOutPending,
  signOutError, onNavigate(path), profileRequest, onOpenProjectCreate(), onRestoreProject(id),
  exportData, onGoogleEventsChange }
```
Remove `homeRequest` and `lists`-related props (`lists`, default list) if present.

## Build
- Keep the overview → detail-panel IA. Page: `.page` with `.page-header` (title `Settings`;
  when a detail panel is open show a `Back` ghost button + panel title), `.page-body.is-narrow`.
- Overview: account header (`Avatar lg`, name, email), then `.settings-group` cards
  (`.settings-group-title` 11px uppercase muted) with `.settings-row` buttons (label
  14px, value 13px muted, `chevron-right`), `ToggleRow` uses `Checkbox`-styled switch
  (`.switch`).
- Remove rows/panels: Background, Default List, Import Data, External Suggestions, Reset
  Filter Suggestions, What's New (and the `BackgroundSettingsPanel`). Keep everything else
  (see §6.7 list). Delete now-unused props/state (`backgroundLabel`, `defaultListLabel`,
  `selectedList`, `lists`).
- Detail panels (`SettingsDetail`): title + description, `SelectionRows` as `.option-list`
  radio rows with check icon, forms with `Field`/`Input`/`Select`, `Button`s; Profile panel:
  display name field + Save, danger zone (`Sign out`, `Delete account` with `ConfirmDialog`);
  Google Calendar panel: connection card with status `Badge`, Connect/Sync/Disconnect buttons;
  Archived projects: `.row-list` with Restore; Project reminders: number field + toggles.
- Messages via `InlineNotice`. Write `src/styles/settings.css` from scratch.
- `src/settings/SettingsControls.jsx` becomes thin wrappers over primitives (keep exports
  used by tests: `SettingsGroup`, `SettingsRow`, `ToggleRow`, `SelectionRows`,
  `SettingsDetail` — adjust names only if you update every importer/test).

## Tests
Update `src/SettingsPage.test.jsx` and `src/settings/*.test.jsx`: remove assertions for the
deleted rows/panels, keep the rest (theme change commits, default view, time settings,
profile save, delete account confirm, Google connect flows, archived projects restore,
project reminders).

## Verify
`npx vitest run src/SettingsPage.test.jsx src/settings` passes; `npx oxlint` clean. No build.
