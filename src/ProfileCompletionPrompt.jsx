export default function ProfileCompletionPrompt({
  displayName,
  onOpenProfile,
  onDismiss,
}) {
  if (String(displayName || "").trim()) return null;

  return (
    <aside className="profile-completion-prompt" aria-labelledby="profile-completion-title">
      <div>
        <strong id="profile-completion-title">Finish your profile</strong>
        <p>Help teammates recognize you.</p>
      </div>
      <div className="profile-completion-actions">
        <button className="primary-btn compact-btn" type="button" onClick={onOpenProfile}>
          Add display name
        </button>
        <button
          className="ghost-btn compact-btn"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss profile completion reminder"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
