import { useState } from "react";
import { signOutAccount } from "../auth/accountActions";
import { selectSettings, selectUi, selectUser } from "../store/selectors";
import { useStore } from "../store/store";
import { navigate, openProfileSettings } from "../store/ui";
import { Avatar, Icon, Menu } from "../ui";

/**
 * The signed-in person's row at the bottom of the sidebar: Profile, Settings
 * and Sign out. A failed sign-out keeps the session and reports itself here so
 * the person can simply try again.
 */
export function UserMenu() {
  const user = useStore(selectUser);
  const settings = useStore(selectSettings);
  const { sidebarCollapsed } = useStore(selectUi);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const displayName =
    settings.profile.displayName || user?.displayName || user?.email || "Account";

  const handleSignOut = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    setError(await signOutAccount());
    setPending(false);
  };

  return (
    <>
      <Menu
        className="sidebar-user"
        align="start"
        trigger={(triggerProps) => (
          <button
            type="button"
            className="sidebar-user-trigger"
            aria-label={`Account menu for ${displayName}`}
            title={sidebarCollapsed ? displayName : undefined}
            {...triggerProps}
          >
            <Avatar name={displayName} size="sm" />
            {sidebarCollapsed ? null : (
              <span className="sidebar-user-name truncate">{displayName}</span>
            )}
          </button>
        )}
        items={[
          {
            id: "profile",
            label: "Profile",
            icon: <Icon name="user" />,
            onSelect: openProfileSettings,
          },
          {
            id: "settings",
            label: "Settings",
            icon: <Icon name="settings" />,
            onSelect: () => navigate("/settings"),
          },
          { id: "user-menu-separator", separator: true },
          {
            id: "sign-out",
            label: pending ? "Signing out…" : "Sign out",
            icon: <Icon name="log-out" />,
            disabled: pending,
            onSelect: handleSignOut,
          },
        ]}
      />
      {error ? (
        <p className="sidebar-signout-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
