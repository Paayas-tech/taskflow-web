import { Button, EmptyState } from "../ui";
import { SettingsDetail } from "./SettingsControls";

export default function ArchivedProjectsPanel({
  projects,
  pendingProjectId = "",
  onViewProject,
  onRestoreProject,
}) {
  if (!projects.length) {
    return (
      <SettingsDetail title="Archived projects" description="Projects you have archived.">
        <EmptyState
          icon="archive"
          title="No archived projects"
          description="Archived projects appear here."
        />
      </SettingsDetail>
    );
  }

  return (
    <SettingsDetail title="Archived projects" description="Projects you have archived.">
      <div className="row-list">
        {projects.map((project) => {
          const pending = pendingProjectId === project.id;

          return (
            <div className="settings-project-row" key={project.id}>
              <span className="settings-row-body">
                <span className="settings-row-label">{project.name}</span>
                {project.description ? (
                  <span className="settings-row-description truncate">{project.description}</span>
                ) : null}
              </span>
              <span className="cluster-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => onViewProject(project)}
                >
                  Open
                </Button>
                <Button size="sm" loading={pending} onClick={() => onRestoreProject(project)}>
                  Restore
                </Button>
              </span>
            </div>
          );
        })}
      </div>
    </SettingsDetail>
  );
}
