import { useCallback, useEffect, useRef, useState } from "react";

const projectColors = [
  "#6657c8",
  "#4f8a68",
  "#ad5c74",
  "#b77a24",
  "#64748b",
];

const emptyProjectForm = {
  name: "",
  description: "",
  color: projectColors[0],
};

const statusLabels = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const formatProjectDueDate = (value) => {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatCreatedAt = (value) => {
  if (!value) return "";

  try {
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
};

export default function ProjectsPage({
  projects,
  loading,
  error,
  onRetry,
  onCreateProject,
}) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [values, setValues] = useState(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const createButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const submissionRef = useRef(false);

  const openCreateProject = () => {
    setValues(emptyProjectForm);
    setFormError("");
    setShowCreateProject(true);
  };

  const closeCreateProject = useCallback(() => {
    if (saving) return;

    setShowCreateProject(false);
    setValues(emptyProjectForm);
    setFormError("");
    createButtonRef.current?.focus();
  }, [saving]);

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget) closeCreateProject();
  };

  useEffect(() => {
    if (!showCreateProject) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) {
        closeCreateProject();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCreateProject, saving, showCreateProject]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submissionRef.current) return;

    const name = values.name.trim();
    setFormError("");

    if (!name) {
      setFormError("Enter a project name before saving.");
      return;
    }

    submissionRef.current = true;
    setSaving(true);

    try {
      await onCreateProject({
        name,
        description: values.description,
        color: values.color,
      });
      setShowCreateProject(false);
      setValues(emptyProjectForm);
      createButtonRef.current?.focus();
    } catch (createError) {
      console.error("Error creating project:", createError);
      setFormError(
        "We couldn't create this project. Check your connection and try again."
      );
    } finally {
      submissionRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="projects-page" aria-labelledby="projects-page-title">
      <header className="projects-page-header">
        <div>
          <p className="card-label">Projects</p>
          <h2 id="projects-page-title">Plan meaningful work</h2>
          <p>Keep larger goals visible without changing how your task lists work.</p>
        </div>
        <button
          ref={createButtonRef}
          className="primary-btn"
          type="button"
          onClick={openCreateProject}
          disabled={saving}
          aria-haspopup="dialog"
          aria-expanded={showCreateProject}
          aria-controls="create-project-dialog"
        >
          + New Project
        </button>
      </header>

      {loading ? (
        <div className="projects-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading projects...</h3>
          <p>Your saved projects are being retrieved from Firestore.</p>
        </div>
      ) : error ? (
        <div className="projects-state error-state" role="alert">
          <h3>Projects unavailable</h3>
          <p>{error}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-state projects-empty-state">
          <span className="projects-empty-icon" aria-hidden="true">◇</span>
          <h3>No projects yet</h3>
          <p>Create a project when a goal needs more space than a single task or list.</p>
          <button className="primary-btn" type="button" onClick={openCreateProject}>
            Create your first project
          </button>
        </div>
      ) : (
        <div className="projects-grid" aria-label="Your projects">
          {projects.map((project) => {
            const createdAt = formatCreatedAt(project.createdAt);
            const dueDate = formatProjectDueDate(project.dueDate);

            return (
              <article className="project-card" key={project.id}>
                <div className="project-card-accent" aria-hidden="true">
                  <span style={{ backgroundColor: project.color || projectColors[0] }} />
                </div>
                <div className="project-card-heading">
                  <div>
                    <h3>{project.name}</h3>
                    <span className={`project-status project-status-${project.status}`}>
                      {statusLabels[project.status] || "Active"}
                    </span>
                  </div>
                </div>
                {project.description && (
                  <p className="project-description">{project.description}</p>
                )}
                <div className="project-metadata">
                  {dueDate && <span>Due {dueDate}</span>}
                  {createdAt && <span>Created {createdAt}</span>}
                  {!dueDate && !createdAt && <span>Ready for planning</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreateProject && (
        <div className="task-modal-backdrop" onMouseDown={handleBackdrop}>
          <section
            ref={dialogRef}
            className="task-modal project-modal"
            id="create-project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-dialog-title"
            aria-describedby="create-project-dialog-description"
            aria-busy={saving}
          >
            <div className="task-modal-header">
              <div>
                <p className="card-label">New project</p>
                <h2 id="create-project-dialog-title">Create Project</h2>
                <p id="create-project-dialog-description">
                  Give this work area a clear name and a recognizable color.
                </p>
              </div>
              <button
                className="ghost-btn compact-btn task-modal-close"
                type="button"
                onClick={closeCreateProject}
                disabled={saving}
                aria-label="Close Create Project dialog"
              >
                Close
              </button>
            </div>

            <form className="project-form" onSubmit={handleSubmit} noValidate>
              <label className="project-form-field project-name-field">
                <span>Project name</span>
                <input
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  placeholder="e.g. Website launch"
                  disabled={saving}
                  autoFocus
                />
              </label>

              <label className="project-form-field">
                <span>Description <small>Optional</small></span>
                <textarea
                  name="description"
                  value={values.description}
                  onChange={handleChange}
                  placeholder="What outcome are you working toward?"
                  rows="4"
                  disabled={saving}
                />
              </label>

              <fieldset className="project-color-field" disabled={saving}>
                <legend>Color</legend>
                <div className="project-color-options">
                  {projectColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={values.color === color ? "selected" : ""}
                      style={{ backgroundColor: color }}
                      onClick={() => setValues((previous) => ({ ...previous, color }))}
                      aria-label={`Use ${color} for this project`}
                      aria-pressed={values.color === color}
                    />
                  ))}
                </div>
              </fieldset>

              {formError && <p className="form-error" role="alert">{formError}</p>}

              <div className="project-form-actions">
                <button className="ghost-btn" type="button" onClick={closeCreateProject} disabled={saving}>
                  Cancel
                </button>
                <button className="primary-btn" type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
