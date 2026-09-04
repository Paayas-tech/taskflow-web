# Design QA

## Scope

- Project overview, list, stories, Projects index, Home, and My Tasks gutters
- Project-row action menu overflow and positioning

## Reference artifacts

- `/Users/karthikrajagopalan/Desktop/Screenshot 2026-09-03 at 8.27.06 PM.png`
- `/Users/karthikrajagopalan/Desktop/Screenshot 2026-09-03 at 8.27.12 PM.png`
- `/Users/karthikrajagopalan/Desktop/Screenshot 2026-09-03 at 8.27.19 PM.png`
- `/Users/karthikrajagopalan/Desktop/Screenshot 2026-09-03 at 8.27.24 PM.png`
- `/Users/karthikrajagopalan/Desktop/Screenshot 2026-09-03 at 8.27.28 PM.png`

The latest review clarified that the main work surfaces should share Home's edge gutter instead of retaining the centered 1200px content cap visible in the earlier captures.

## Implementation captures

- `/private/tmp/taskflow-wide-home.png`
- `/private/tmp/taskflow-wide-my-tasks.png`
- `/private/tmp/taskflow-wide-projects.png`
- `/private/tmp/taskflow-wide-overview.png`
- `/private/tmp/taskflow-wide-list.png`
- `/private/tmp/taskflow-wide-stories.png`
- `/private/tmp/taskflow-wide-project-menu.png`

## Comparison

- Full-view comparisons used a 1482 × 743 viewport, matching the application area of the supplied Chrome captures.
- Projects, My Tasks, project Overview, project List, and Stories now begin at the same 24px content gutter as Home and expand to the matching right gutter.
- The board view retains its existing horizontal-scroll treatment; deliberately reading-focused pages such as Settings and Inbox retain the shared narrow-page cap.
- Typography, borders, radii, colors, icon sizing, control density, and visible interaction states show no material drift.
- The project action menu renders outside overflow-clipped row lists, stays inside the viewport, and is fully visible below its trigger in the reviewed state.
- Navigation between Overview, List, and Stories, plus opening the project-row menu, was exercised in the authenticated browser session.

## Iterations

1. The first review preserved the 1200px centered cap, so the requested spacing remained visually unchanged.
2. Removed the cap from the named work surfaces and rechecked each route against Home's gutter at the reference viewport.

Final result: passed
