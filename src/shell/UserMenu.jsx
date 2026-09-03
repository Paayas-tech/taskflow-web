import { Avatar, Icon, Menu } from "../ui";

/**
 * The signed-in person's row at the bottom of the sidebar: Profile, Settings
 * and Sign out.
 */
export function UserMenu({
  user,
  collapsed = false,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  signOutPending = false,
}) {
  const displayName = user?.displayName || user?.email || "Account";

  return (
    <Menu
      className="sidebar-user"
      align="start"
      trigger={(triggerProps) => (
        <button
          type="button"
          className="sidebar-user-trigger"
          aria-label={`Account menu for ${displayName}`}
          title={collapsed ? displayName : undefined}
          {...triggerProps}
        >
          <Avatar name={displayName} size="sm" />
          {collapsed ? null : (
            <span className="sidebar-user-name truncate">{displayName}</span>
          )}
        </button>
      )}
      items={[
        {
          id: "profile",
          label: "Profile",
          icon: <Icon name="user" />,
          onSelect: onOpenProfile,
        },
        {
          id: "settings",
          label: "Settings",
          icon: <Icon name="settings" />,
          onSelect: onOpenSettings,
        },
        { id: "user-menu-separator", separator: true },
        {
          id: "sign-out",
          label: signOutPending ? "Signing out…" : "Sign out",
          icon: <Icon name="log-out" />,
          disabled: signOutPending,
          onSelect: onSignOut,
        },
      ]}
    />
  );
}

export default UserMenu;
