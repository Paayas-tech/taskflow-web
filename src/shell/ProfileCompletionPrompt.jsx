import { readProfilePromptDismissed } from "../lib/preferences";
import { selectLoaded, selectSettings, selectUi, selectUser } from "../store/selectors";
import { useStore } from "../store/store";
import { dismissProfilePrompt, openProfileSettings } from "../store/ui";
import { Button, InlineNotice } from "../ui";

/**
 * Asks for a display name once the account settings have loaded without one.
 * Dismissing it is remembered for the rest of the browser session.
 */
export function ProfileCompletionPrompt() {
  const user = useStore(selectUser);
  const settings = useStore(selectSettings);
  const loaded = useStore(selectLoaded);
  const { profilePromptDismissed } = useStore(selectUi);

  if (loaded.settings !== "ready") return null;
  if (String(settings.profile.displayName || "").trim()) return null;
  if (profilePromptDismissed || readProfilePromptDismissed(user?.id)) return null;

  return (
    <InlineNotice
      tone="info"
      className="profile-completion-prompt"
      action={
        <>
          <Button variant="primary" size="sm" onClick={openProfileSettings}>
            Set display name
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissProfilePrompt}>
            Dismiss
          </Button>
        </>
      }
    >
      Add a display name to help teammates recognize you.
    </InlineNotice>
  );
}
