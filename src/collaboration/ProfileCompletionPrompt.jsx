import { Button, InlineNotice } from "../ui";

export default function ProfileCompletionPrompt({
  displayName,
  onOpenProfile,
  onDismiss,
}) {
  if (String(displayName || "").trim()) return null;

  return (
    <InlineNotice
      tone="info"
      className="profile-completion-prompt"
      action={
        <>
          <Button variant="primary" size="sm" onClick={onOpenProfile}>
            Set display name
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </>
      }
    >
      Add a display name to help teammates recognize you.
    </InlineNotice>
  );
}
