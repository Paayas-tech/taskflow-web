import { selectUi } from "../store/selectors";
import { useStore } from "../store/store";
import { setMobileNav } from "../store/ui";

/**
 * Two-column application frame: the sidebar column and the scrolling page
 * column. The sidebar becomes an off-canvas drawer below 900px.
 */
export function AppShell({ sidebar = null, children }) {
  const { sidebarCollapsed, mobileNavOpen } = useStore(selectUi);

  const className = [
    "app-shell",
    sidebarCollapsed && "is-collapsed",
    mobileNavOpen && "is-mobile-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {sidebar}
      {mobileNavOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <main className="app-main">{children}</main>
    </div>
  );
}
