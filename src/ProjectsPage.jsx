import { useCallback, useEffect, useRef, useState } from "react";
import InvitationRow from "./InvitationRow";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";

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
  onUpdateProject,
  onDeleteProject,
  onOpenProject,
  createRequest = 0,
  userId,
  invitations = [],
  invitationsLoading = false,
  invitationsError = "",
  onRetryInvitations,
  onAcceptInvitation,
  onDeclineInvitation,
}) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [values, setValues] = useState(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [projectActionId, setProjectActionId] = useState(null);
  const [invitationActionId, setInvitationActionId] = useState("");
  const [formError, setFormError] = useState("");
  const createButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const submissionRef = useRef(false);

  useEffect(() => {
    if (!createRequest) return;
    setEditingProject(null);
    setValues(emptyProjectForm);
    setFormError("");
    setShowCreateProject(true);
  }, [createRequest]);

  const openCreateProject = () => {
    setEditingProject(null);
    setValues(emptyProjectForm);
    setFormError("");
    setShowCreateProject(true);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setValues({
      name: project.name || "",
      description: project.description || "",
      color: project.color || projectColors[0],
    });
    setFormError("");
    setShowCreateProject(true);
  };

  const closeCreateProject = useCallback(() => {
    if (saving) return;

    setShowCreateProject(false);
    setEditingProject(null);
    setValues(emptyProjectForm);
    setFormError("");
  }, [saving]);

  const { onBackdropMouseDown: handleBackdrop } = useModalLifecycle({
    isOpen: showCreateProject,
    modalRef: dialogRef,
    onClose: closeCreateProject,
    triggerRef: createButtonRef,
    initialFocusRef: projectNameInputRef,
    isDismissDisabled: saving,
    allowEscape: true,
    allowBackdropDismiss: true,
    restoreFocus: true,
    lockBodyScroll: true,
  });

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
      const data = { name, description: values.description, color: values.color };
      if (editingProject) await onUpdateProject(editingProject.id, data);
      else await onCreateProject(data);
      setShowCreateProject(false);
      setEditingProject(null);
      setValues(emptyProjectForm);
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

  const confirmDeleteProject = async () => {
    if (!projectToDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      setDeleteError("We couldn't delete this project. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleProjectArchive = async (project) => {
    if (projectActionId) return;
    setProjectActionError("");
    setProjectActionId(project.id);
    try {
      await onUpdateProject(project.id, {
        status: project.status === "archived" ? "active" : "archived",
      });
    } catch (error) {
      console.error("Error updating project archive state:", error);
      setProjectActionError(
        `We couldn't ${project.status === "archived" ? "restore" : "archive"} “${project.name}”. Try again.`
      );
    } finally {
      setProjectActionId(null);
    }
  };

  const handleInvitation = async (invitation, action) => {
    if (invitationActionId) return;
    setInvitationActionId(invitation.id);
    setProjectActionError("");
    try {
      await action(invitation.id);
    } catch (invitationError) {
      console.error("Error responding to project invitation:", invitationError);
      setProjectActionError(
        invitationError?.message || "We couldn't update this invitation. Try again."
      );
    } finally {
      setInvitationActionId("");
    }
  };

  const ownedProjects = projects.filter(
    (project) => project.ownerId === userId || project.viewerRole === "owner"
  );
  const sharedProjects = projects.filter(
    (project) => project.ownerId !== userId && project.viewerRole !== "owner"
  );

  const renderProjectCard = (project) => {
    const createdAt = formatCreatedAt(project.createdAt);
    const dueDate = formatProjectDueDate(project.dueDate);
    const isOwner = project.ownerId === userId || project.viewerRole === "owner";

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
            {!isOwner && (
              <span className="project-status">{project.viewerRole || "member"}</span>
            )}
          </div>
        </div>
        {project.description && <p className="project-description">{project.description}</p>}
        <div className="project-metadata">
          {dueDate && <span>Due {dueDate}</span>}
          {createdAt && <span>Created {createdAt}</span>}
          {!dueDate && !createdAt && <span>Ready for planning</span>}
        </div>
        <div className="project-card-actions">
          <button className="ghost-btn compact-btn" type="button" onClick={() => onOpenProject(project.id)} aria-label={`View tasks in ${project.name}`}>View project</button>
          {isOwner && (
            <>
              <button className="ghost-btn compact-btn" type="button" onClick={() => openEditProject(project)}>Edit</button>
              <button className="ghost-btn compact-btn" type="button" onClick={() => toggleProjectArchive(project)} disabled={projectActionId === project.id}>
                {projectActionId === project.id
                  ? project.status === "archived" ? "Restoring..." : "Archiving..."
                  : project.status === "archived" ? "Restore" : "Archive"}
              </button>
              <button className="danger-btn compact-btn" type="button" onClick={() => { setDeleteError(""); setProjectToDelete(project); }}>Delete</button>
            </>
          )}
        </div>
      </article>
    );
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

      {projectActionError && (
        <div className="inline-error" role="alert">
          <p>{projectActionError}</p>
          <button className="ghost-btn compact-btn" type="button" onClick={() => setProjectActionError("")}>Dismiss</button>
        </div>
      )}

      {(invitationsLoading || invitationsError || invitations.length > 0) && (
        <section aria-labelledby="project-invitations-title">
          <h3 id="project-invitations-title">Invitations</h3>
          {invitationsLoading ? (
            <div className="projects-state" role="status"><div className="state-spinner" /><p>Loading invitations...</p></div>
          ) : invitationsError ? (
            <div className="projects-state error-state" role="alert"><p>{invitationsError}</p><button className="ghost-btn" type="button" onClick={onRetryInvitations}>Try again</button></div>
          ) : (
            <div className="projects-grid">
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  incoming
                  busy={invitationActionId === invitation.id}
                  onAccept={(selected) => handleInvitation(selected, onAcceptInvitation)}
                  onDecline={(selected) => handleInvitation(selected, onDeclineInvitation)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="projects-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading projects...</h3>
          <p>Your saved projects are being retrieved securely.</p>
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
        <div>
          <section aria-labelledby="owned-projects-title">
            <h3 id="owned-projects-title">My Projects</h3>
            {ownedProjects.length ? <div className="projects-grid">{ownedProjects.map(renderProjectCard)}</div> : <p className="project-description">You do not own any projects yet.</p>}
          </section>
          <section aria-labelledby="shared-projects-title">
            <h3 id="shared-projects-title">Shared with Me</h3>
            {sharedProjects.length ? <div className="projects-grid">{sharedProjects.map(renderProjectCard)}</div> : <p className="project-description">Projects you accept will appear here.</p>}
          </section>
        </div>
      )}

      {showCreateProject && (
        <div className="task-modal-backdrop" onMouseDown={handleBackdrop}>
          <section
            ref={dialogRef}
            className="task-modal project-modal"
            id="create-project-dialog"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="create-project-dialog-title"
            aria-describedby="create-project-dialog-description"
            aria-busy={saving}
          >
            <div className="task-modal-header">
              <div>
                <p className="card-label">{editingProject ? "Project details" : "New project"}</p>
                <h2 id="create-project-dialog-title">{editingProject ? "Edit Project" : "Create Project"}</h2>
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
                  ref={projectNameInputRef}
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
                  {saving
                    ? editingProject ? "Saving..." : "Creating..."
                    : editingProject ? "Save changes" : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {projectToDelete && (
        <div className="confirmation-backdrop">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-busy={deleting}>
            <p className="card-label">Permanent action</p>
            <h3 id="delete-project-title">Delete “{projectToDelete.name}”?</h3>
            <p>This permanently deletes the project and its project tasks. This cannot be undone.</p>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="confirmation-actions">
              <button className="ghost-btn" type="button" disabled={deleting} onClick={() => setProjectToDelete(null)}>Cancel</button>
              <button className="danger-btn" type="button" disabled={deleting} onClick={confirmDeleteProject}>{deleting ? "Deleting..." : "Delete project"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
