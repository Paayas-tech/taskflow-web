import { useMemo } from "react";
import { projectPath } from "../app/appRoutes";
import { readProjectTab } from "../shell/projectTabPreference";
import { Button, EmptyState, Icon, IconButton } from "../ui";
import { recentProjects } from "./homeData";
import { Widget, WidgetError, WidgetSkeleton } from "./Widget";

const VISIBLE_LIMIT = 6;

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

/** Active projects, most recently updated first, opening on their last tab. */
export function ProjectsWidget({
  projects = [],
  loading = false,
  error = "",
  onRetry,
  onNavigate,
  onNewProject,
}) {
  const visible = useMemo(() => recentProjects(projects, VISIBLE_LIMIT), [projects]);

  return (
    <Widget
      className="projects-widget"
      title="Projects"
      actions={
        <>
          <IconButton label="New project" size="sm" onClick={() => onNewProject?.()}>
            <Icon name="plus" />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.("/projects")}>
            View all
          </Button>
        </>
      }
    >
      {loading ? <WidgetSkeleton label="Loading projects" /> : null}
      {!loading && error ? <WidgetError message={error} onRetry={onRetry} /> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState
          icon="folders"
          title="No projects yet"
          description="Create one to group work and invite people."
          action={
            <Button variant="secondary" size="sm" onClick={() => onNewProject?.()}>
              Create a project
            </Button>
          }
        />
      ) : null}
      {!loading && !error
        ? visible.map((project) => (
            <button
              key={project.id}
              type="button"
              className="widget-row project-row"
              onClick={() =>
                onNavigate?.(projectPath(project.id, readProjectTab(project.id)))
              }
            >
              <span
                className="project-row-color"
                style={{ backgroundColor: project.color || "var(--color-accent)" }}
                aria-hidden="true"
              />
              <span className="project-row-name truncate">{project.name}</span>
              {roleLabels[project.viewerRole] ? (
                <span className="project-row-meta muted">
                  {roleLabels[project.viewerRole]}
                </span>
              ) : null}
            </button>
          ))
        : null}
    </Widget>
  );
}

export default ProjectsWidget;
