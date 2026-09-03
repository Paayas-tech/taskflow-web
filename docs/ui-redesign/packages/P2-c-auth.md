# Package P2-c — auth screens

You own `src/auth/*` (already moved here: `Login.jsx`, `Onboarding.jsx`, `Recover.jsx`,
`ConfigurationErrorScreen.jsx` and their tests) and `src/styles/auth.css`. Nothing else.

## Read first
`docs/ui-redesign/DESIGN_SPEC.md` §0, §3, §4, §6.8, §11, §12; `src/ui/index.js` and the
primitives; the four components and their tests.

## Deliverables
Restyle all four screens with the primitives and tokens while preserving every behavior,
prop, service call, validation message, aria attribute and test-covered flow (sign in / sign
up / OTP / resend / forgot password / recovery / onboarding choices / start over /
configuration error retry). Layout: `.auth-page` (min-height 100vh, `--color-bg`, centered),
`.auth-card` (400px, surface, border, radius-lg, 32px padding), `.auth-brand` (mark +
wordmark), `.auth-title` 22px/600, `.auth-subtitle` 13px muted, forms use `Field` +
`Input`, submit uses `Button variant="primary" loading`, mode switch uses
`SegmentedControl`, errors/notices use `InlineNotice`. Onboarding: two-step card with
`.choice-card` radio list (icon, label, description, checked state accent border).
Configuration error: card with `alert-circle` icon, title, explanation, `Retry` button.

Rewrite `src/styles/auth.css` from scratch (the old rules in the deleted `App.css` are gone).
Update the four test files only as needed for the new structure; keep the behavior
assertions.

## Verify
`npx vitest run src/auth` passes; `npx oxlint` clean. Do not run `npm run build`.
