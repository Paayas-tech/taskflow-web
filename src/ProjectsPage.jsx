import { useCallback, useEffect, useRef, useState } from "react";
import InvitationRow from "./InvitationRow";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";
import { prefetchProjectWorkspace } from "./application/projectWorkspaceLoader";

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
  createTriggerRef,
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
  const [viewingProject, setViewingProject] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [projectActionId, setProjectActionId] = useState(null);
  const [invitationActionId, setInvitationActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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
    setViewingProject(null);
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
    triggerRef: createTriggerRef,
    initialFocusRef: projectNameInputRef,
    isDismissDisabled: saving,
    allowEscape: true,
    allowBackdropDismiss: true,
    restoreFocus: true,
    lockBodyScroll: true,
  });

  const closeProjectDetails = useCallback(() => {
    setViewingProject(null);
  }, []);

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
      setViewingProject(null);
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

  const visibleProjects = projects.filter((project) => {
    const isOwner = project.ownerId === userId || project.viewerRole === "owner";
    const matchesSearch = `${project.name || ""} ${project.description || ""}`
      .toLowerCase()
      .includes(projectSearch.trim().toLowerCase());
    const matchesOwnership = ownershipFilter === "all"
      || (ownershipFilter === "owned" ? isOwner : !isOwner);
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesOwnership && matchesStatus;
  });

  const renderProjectCard = (project) => {
    const createdAt = formatCreatedAt(project.createdAt);
    const dueDate = formatProjectDueDate(project.dueDate);
    const isOwner = project.ownerId === userId || project.viewerRole === "owner";

    return (
      <article
        className={`project-table-row${viewingProject?.id === project.id ? " selected" : ""}`}
        key={project.id}
      >
        <button
          className="project-row-primary"
          type="button"
          aria-pressed={viewingProject?.id === project.id}
          onClick={() => {
            setViewingProject(project);
            void prefetchProjectWorkspace(userId, project.id)?.catch(() => {});
          }}
          aria-label={`View details for ${project.name}`}
        >
          <span className="project-row-icon" style={{ "--project-color": project.color || projectColors[0] }} aria-hidden="true">□</span>
          <span className="project-row-name">
            <h3>{project.name}</h3>
            <small>{project.description || "Ready for planning"}</small>
          </span>
        </button>
        <span className="project-row-access">{isOwner ? "Owner" : project.viewerRole || "Member"}</span>
        <span><span className={`project-status project-status-${project.status}`}>{statusLabels[project.status] || "Active"}</span></span>
        <span className="project-row-date">{formatCreatedAt(project.updatedAt) || createdAt || (dueDate ? `Due ${dueDate}` : "—")}</span>
        <button
          className="project-row-more"
          type="button"
          onClick={() => {
            setViewingProject(project);
            void prefetchProjectWorkspace(userId, project.id)?.catch(() => {});
          }}
          aria-label={`More details for ${project.name}`}
        >•••</button>
      </article>
    );
  };

  return (
    <section className="projects-page" aria-label="Projects">
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
          <p>Loading projects…</p>
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
          <h3>No projects yet</h3>
          <button className="primary-btn" type="button" onClick={openCreateProject}>
            Create your first project
          </button>
        </div>
      ) : (
        <div className={`projects-workspace${viewingProject ? " has-details" : ""}`}>
          <div className="projects-workspace-main">
            <div className="projects-toolbar" aria-label="Project search and filters">
              <label className="projects-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Search projects..."
                  aria-label="Search projects"
                />
              </label>
              <div className="projects-filters">
                <label>
                  <span className="sr-only">Ownership</span>
                  <select value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value)}>
                    <option value="all">All access</option>
                    <option value="owned">Owner</option>
                    <option value="shared">Shared with me</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="projects-list-actions">
              <button
                ref={createTriggerRef}
                className="primary-btn compact-btn"
                type="button"
                onClick={openCreateProject}
                aria-haspopup="dialog"
                aria-controls="create-project-dialog"
              >
                + Add project
              </button>
            </div>

            <div className="project-table" role="table" aria-label="Projects">
              <div className="project-table-header" role="row">
                <span>Name</span><span>Access</span><span>Status</span><span>Last modified</span><span aria-hidden="true" />
              </div>
              <div className="project-table-body">
                {visibleProjects.map(renderProjectCard)}
                {visibleProjects.length === 0 && (
                  <p className="project-table-empty">No matching projects</p>
                )}
              </div>
            </div>
            <p className="projects-result-count">Showing {visibleProjects.length} of {projects.length} projects</p>
          </div>

          {viewingProject && (
            <div className="project-context-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProjectDetails(); }}>
            <aside className="project-context-panel" role="dialog" aria-modal="true" aria-labelledby="project-details-title">
              <div className="project-context-header">
                <span className="project-row-icon" style={{ "--project-color": viewingProject.color || projectColors[0] }} aria-hidden="true">□</span>
                <div><p className="card-label">Project</p><h2 id="project-details-title">{viewingProject.name}</h2></div>
                <span className={`project-status project-status-${viewingProject.status}`}>{statusLabels[viewingProject.status] || "Active"}</span>
                <button className="icon-btn" type="button" onClick={closeProjectDetails} aria-label="Close project details">×</button>
              </div>
              <div className="project-context-tabs" aria-label="Project details sections">
                <span className="active">Overview</span>
              </div>
              <div className="project-context-content">
                <section>
                  <h3>Description</h3>
                  <p className="project-description-compact">{viewingProject.description || "No description."}</p>
                </section>
                <dl className="project-context-facts">
                  <div><dt>Your access</dt><dd>{viewingProject.viewerRole || (viewingProject.ownerId === userId ? "owner" : "member")}</dd></div>
                  <div><dt>Status</dt><dd><span className={`project-status project-status-${viewingProject.status}`}>{statusLabels[viewingProject.status] || "Active"}</span></dd></div>
                  {formatCreatedAt(viewingProject.createdAt) && <div><dt>Created</dt><dd>{formatCreatedAt(viewingProject.createdAt)}</dd></div>}
                  {formatCreatedAt(viewingProject.updatedAt) && <div><dt>Last modified</dt><dd>{formatCreatedAt(viewingProject.updatedAt)}</dd></div>}
                  {formatProjectDueDate(viewingProject.dueDate) && <div><dt>Due date</dt><dd>{formatProjectDueDate(viewingProject.dueDate)}</dd></div>}
                </dl>
              </div>
              <div className="project-context-actions">
                <button className="primary-btn" type="button" onClick={() => onOpenProject(viewingProject.id)}>Open project</button>
                {(viewingProject.ownerId === userId || viewingProject.viewerRole === "owner") && (
                  <details className="project-context-menu">
                    <summary aria-label="Project actions" title="Project actions">•••</summary>
                    <div>
                      <button type="button" onClick={() => openEditProject(viewingProject)}>Edit</button>
                      <button type="button" onClick={() => toggleProjectArchive(viewingProject)} disabled={projectActionId === viewingProject.id}>{projectActionId === viewingProject.id ? "Updating..." : viewingProject.status === "archived" ? "Restore" : "Archive"}</button>
                      <button className="is-danger" type="button" onClick={() => { setDeleteError(""); setViewingProject(null); setProjectToDelete(viewingProject); }}>Delete</button>
                    </div>
                  </details>
                )}
              </div>
            </aside>
            </div>
          )}
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
                  Name and identify this project.
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
                  placeholder="Short project summary"
                  rows="2"
                  maxLength="1000"
                  disabled={saving}
                />
                <small className="task-description-count">{values.description.length}/1000</small>
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
            <p>Deletes this project and its tasks permanently.</p>
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
