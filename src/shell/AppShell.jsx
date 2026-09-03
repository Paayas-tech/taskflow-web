/**
 * Two-column application frame: the sidebar column and the scrolling page
 * column. The sidebar becomes an off-canvas drawer below 900px.
 */
export function AppShell({
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
  sidebar = null,
  children,
}) {
  const className = ["app-shell", collapsed && "is-collapsed", mobileOpen && "is-mobile-open"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {sidebar}
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onMobileClose}
        />
      ) : null}
      <main className="app-main">{children}</main>
    </div>
  );
}

export default AppShell;
