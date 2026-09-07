import { readProjectTab } from "../lib/preferences";
import {
  isNavigationItemActive,
  navigationItems,
  projectIdFromPath,
  projectPath,
  routeViewFromPath,
} from "../router";
import {
  selectActiveProjects,
  selectInvitations,
  selectPath,
  selectUi,
  selectUnreadCount,
} from "../store/selectors";
import { useStore } from "../store/store";
import {
  navigate,
  openComposer,
  openProjectCreate,
  setSearchOpen,
  toggleSidebar,
} from "../store/ui";
import { Button, Icon, IconButton, Kbd } from "../ui";
import { UserMenu } from "./UserMenu";

const badgeFor = (itemPath, unreadCount, invitationCount) => {
  if (itemPath === "/inbox" && unreadCount > 0) {
    return { count: unreadCount, description: `${unreadCount} unread` };
  }
  if (itemPath === "/projects" && invitationCount > 0) {
    return {
      count: invitationCount,
      description: `${invitationCount} pending ${
        invitationCount === 1 ? "invitation" : "invitations"
      }`,
    };
  }
  return null;
};

/** Primary navigation: brand, create, search, views, projects and account. */
export function Sidebar() {
  const path = useStore(selectPath);
  const projects = useStore(selectActiveProjects);
  const unreadCount = useStore(selectUnreadCount);
  const invitations = useStore(selectInvitations);
  const { sidebarCollapsed: collapsed, mobileNavOpen } = useStore(selectUi);

  const currentView = routeViewFromPath(path);
  const selectedProjectId = projectIdFromPath(path);
  const settingsActive = isNavigationItemActive("/settings", path, currentView);

  return (
    <aside
      className={["sidebar", collapsed && "is-collapsed", mobileNavOpen && "is-open"]
        .filter(Boolean)
        .join(" ")}
      aria-label="Sidebar"
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
        {collapsed ? null : <span className="sidebar-brand-name">TaskFlow</span>}
        <IconButton
          className="sidebar-collapse"
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="sm"
          onClick={toggleSidebar}
        >
          <Icon name="panel-left" />
        </IconButton>
      </div>

      <div className="sidebar-actions">
        <Button
          className="sidebar-new-task"
          variant="primary"
          icon={<Icon name="plus" />}
          aria-label="New task"
          title={collapsed ? "New task" : undefined}
          onClick={() => openComposer()}
        >
          {collapsed ? null : "New task"}
        </Button>
        <button
          type="button"
          className="sidebar-search"
          aria-label="Search"
          title={collapsed ? "Search" : undefined}
          onClick={() => setSearchOpen(true)}
        >
          <Icon name="search" />
          {collapsed ? null : (
            <>
              <span className="sidebar-search-label">Search</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {navigationItems.map((item) => {
          const active = isNavigationItemActive(item.path, path, currentView);
          const badge = badgeFor(item.path, unreadCount, invitations.length);
          return (
            <button
              key={item.path}
              type="button"
              className={`nav-item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${item.label}, ${badge.description}` : item.label}
              title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.path)}
            >
              <Icon name={item.icon} />
              {collapsed ? null : (
                <span className="nav-item-label">{item.label}</span>
              )}
              {badge ? (
                <span className="nav-badge" aria-hidden="true">
                  {badge.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {collapsed ? null : (
        <div className="sidebar-projects">
          <p className="sidebar-section-title">
            <span>Projects</span>
            <IconButton label="New project" size="sm" onClick={openProjectCreate}>
              <Icon name="plus" />
            </IconButton>
          </p>
          {projects.length === 0 ? (
            <p className="sidebar-projects-empty muted">No projects yet</p>
          ) : (
            <div className="sidebar-project-list">
              {projects.map((project) => {
                const active = project.id === selectedProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`project-nav-item${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={project.name}
                    onClick={() =>
                      navigate(projectPath(project.id, readProjectTab(project.id)))
                    }
                  >
                    <span
                      className="project-nav-color"
                      style={{
                        backgroundColor: project.color || "var(--color-accent)",
                      }}
                      aria-hidden="true"
                    />
                    <span className="project-nav-name truncate">{project.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="sidebar-footer">
        <button
          type="button"
          className={`nav-item${settingsActive ? " is-active" : ""}`}
          aria-current={settingsActive ? "page" : undefined}
          aria-label="Settings"
          title={collapsed ? "Settings" : undefined}
          onClick={() => navigate("/settings")}
        >
          <Icon name="settings" />
          {collapsed ? null : <span className="nav-item-label">Settings</span>}
        </button>
        <UserMenu />
      </div>
    </aside>
  );
}
