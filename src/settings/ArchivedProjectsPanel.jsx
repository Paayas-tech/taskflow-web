import { SettingsDetail } from "./SettingsControls";

export default function ArchivedProjectsPanel({
  projects,
  pendingProjectId,
  onViewProject,
  onRestoreProject,
  onBack,
}) {
  return (
    <SettingsDetail
      title="Archived Projects"
      description="Projects already marked archived."
      onBack={onBack}
    >
      {projects.length ? (
        <div className="settings-compact-list settings-archived-projects">
          {projects.map((project) => {
            const pending = pendingProjectId === project.id;
            return (
              <div className="settings-archived-project" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  {project.description && <small>{project.description}</small>}
                </div>
                <div className="settings-archived-project-actions">
                  <button
                    className="ghost-btn compact-btn"
                    type="button"
                    onClick={() => onViewProject(project)}
                    disabled={pending}
                  >
                    View
                  </button>
                  <button
                    className="ghost-btn compact-btn"
                    type="button"
                    onClick={() => onRestoreProject(project)}
                    disabled={pending}
                  >
                    {pending ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="settings-placeholder-panel"><p>No archived projects.</p></div>
      )}
    </SettingsDetail>
  );
}
