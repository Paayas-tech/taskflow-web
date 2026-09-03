import { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { Checkbox, Input } from "../ui/Field";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/icons";
import { InlineNotice } from "../ui/InlineNotice";
import { Menu } from "../ui/Menu";
import { SegmentedControl } from "../ui/SegmentedControl";
import { cx } from "../ui/cx";
import InvitationRow from "../collaboration/InvitationRow";
import ProjectDialog from "../projects/ProjectDialog";
import { prefetchProjectWorkspace } from "../application/projectWorkspaceLoader";
import { taskTimestampToMillis } from "../domain/taskDomain";

const accessOptions = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "shared", label: "Shared" },
];

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.stopPropagation();
  }
};

const isOwnedBy = (project, userId) =>
  project.viewerRole === "owner" || (Boolean(userId) && project.ownerId === userId);

const isArchivedProject = (project) => project.status === "archived";

/** `Updated 3 Sep` (with the year when it is not the current one). */
function formatUpdatedLabel(project, now = new Date()) {
  const millis = taskTimestampToMillis(project?.updatedAt ?? project?.createdAt);
  if (millis === null) return "";

  const date = new Date(millis);
  const sameYear = date.getFullYear() === now.getFullYear();
  const formatted = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);

  return `Updated ${formatted}`;
}

/** Pure filter behind the search box, the access segments and `Show archived`. */
function filterProjects(projects, { userId, access, search, showArchived }) {
  const query = String(search || "").trim().toLowerCase();

  return projects.filter((project) => {
    if (!showArchived && isArchivedProject(project)) return false;

    const owned = isOwnedBy(project, userId);
    if (access === "mine" && !owned) return false;
    if (access === "shared" && owned) return false;

    if (!query) return true;
    return `${project.name || ""} ${project.description || ""}`.toLowerCase().includes(query);
  });
}

export default function ProjectsPage({
  userId,
  projects = [],
  loading = false,
  error = "",
  onRetry,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onOpenProject,
  createRequest = 0,
  invitations = [],
  invitationsLoading = false,
  invitationsError = "",
  onRetryInvitations,
  onAcceptInvitation,
  onDeclineInvitation,
}) {
  const [access, setAccess] = useState("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [actionId, setActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const [invitationBusyId, setInvitationBusyId] = useState("");

  const openCreate = () => {
    setEditingProject(null);
    setDialogError("");
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!createRequest) return;
    setEditingProject(null);
    setDialogError("");
    setDialogOpen(true);
  }, [createRequest]);

  const openEdit = (project) => {
    setEditingProject(project);
    setDialogError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingProject(null);
    setDialogError("");
  };

  const submitProject = async (values) => {
    if (saving) return;

    setSaving(true);
    setDialogError("");
    try {
      if (editingProject) await onUpdateProject?.(editingProject.id, values);
      else await onCreateProject?.(values);
      setDialogOpen(false);
      setEditingProject(null);
    } catch (submitError) {
      console.error("Error saving project:", submitError);
      setDialogError(
        editingProject
          ? "We couldn't save this project. Check your connection and try again."
          : "We couldn't create this project. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (project) => {
    if (actionId) return;
    const archiving = !isArchivedProject(project);

    setActionError("");
    setActionId(project.id);
    try {
      await onUpdateProject?.(project.id, { status: archiving ? "archived" : "active" });
    } catch (archiveError) {
      console.error("Error updating project archive state:", archiveError);
      setActionError(
        `We couldn't ${archiving ? "archive" : "restore"} “${project.name}”. Try again.`
      );
    } finally {
      setActionId("");
    }
  };

  const confirmDelete = async () => {
    if (!projectToDelete || deleting) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteProject?.(projectToDelete.id);
      setProjectToDelete(null);
    } catch (removeError) {
      console.error("Error deleting project:", removeError);
      setDeleteError("We couldn't delete this project. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  const respondToInvitation = async (invitation, action) => {
    if (invitationBusyId) return;

    setActionError("");
    setInvitationBusyId(invitation.id);
    try {
      await action?.(invitation.id);
    } catch (invitationError) {
      console.error("Error responding to project invitation:", invitationError);
      setActionError(invitationError?.message || "We couldn't update this invitation. Try again.");
    } finally {
      setInvitationBusyId("");
    }
  };

  const visibleProjects = filterProjects(projects, { userId, access, search, showArchived });
  const showInvitations = invitationsLoading || Boolean(invitationsError) || invitations.length > 0;

  const renderProjectRow = (project) => {
    const owner = isOwnedBy(project, userId);
    const archived = isArchivedProject(project);
    const roleLabel = roleLabels[project.viewerRole] || (owner ? "Owner" : "Member");
    const updatedLabel = formatUpdatedLabel(project);
    const menuItems = [
      {
        id: "open",
        label: "Open",
        icon: <Icon name="external-link" />,
        onSelect: () => onOpenProject?.(project.id),
      },
      owner
        ? {
            id: "edit",
            label: "Edit",
            icon: <Icon name="edit" />,
            onSelect: () => openEdit(project),
          }
        : null,
      owner
        ? {
            id: "archive",
            label: archived ? "Restore" : "Archive",
            icon: <Icon name={archived ? "archive-restore" : "archive"} />,
            disabled: actionId === project.id,
            onSelect: () => void toggleArchive(project),
          }
        : null,
      owner
        ? {
            id: "delete",
            label: "Delete",
            icon: <Icon name="trash" />,
            danger: true,
            onSelect: () => {
              setDeleteError("");
              setProjectToDelete(project);
            },
          }
        : null,
    ].filter(Boolean);

    const open = () => onOpenProject?.(project.id);

    return (
      <div
        key={project.id}
        className={cx("project-row", archived && "is-archived")}
        role="button"
        tabIndex={0}
        aria-label={`Open ${project.name}`}
        aria-busy={actionId === project.id || undefined}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          open();
        }}
        onMouseEnter={() => {
          prefetchProjectWorkspace(userId, project.id)?.catch(() => {});
        }}
      >
        <span
          className="project-row-color"
          style={{ backgroundColor: project.color || "var(--color-accent)" }}
          aria-hidden="true"
        />

        <span className="project-row-main">
          <span className="project-row-name truncate" title={project.name}>
            {project.name}
          </span>
          {project.description ? (
            <span className="project-row-description truncate">{project.description}</span>
          ) : null}
        </span>

        <span className="project-row-meta">
          <Badge tone="neutral">{roleLabel}</Badge>
          {archived ? <Badge tone="neutral">Archived</Badge> : null}
          {updatedLabel ? <span className="project-row-updated">{updatedLabel}</span> : null}
          <span className="project-row-menu" onClick={stopPointer} onKeyDown={stopKeys}>
            <Menu
              align="end"
              items={menuItems}
              trigger={(triggerProps) => (
                <IconButton label={`More actions for ${project.name}`} size="sm" {...triggerProps}>
                  <Icon name="more-horizontal" />
                </IconButton>
              )}
            />
          </span>
        </span>
      </div>
    );
  };

  const renderProjects = () => {
    if (loading) {
      return (
        <div className="row-list" aria-busy="true">
          <p className="sr-only" role="status">
            Loading projects…
          </p>
          {[0, 1, 2].map((index) => (
            <div className="skeleton-row" key={index} aria-hidden="true">
              <span className="skeleton project-skeleton-color" />
              <span className="skeleton project-skeleton-name" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <InlineNotice
          tone="error"
          action={
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      );
    }

    if (projects.length === 0) {
      return (
        <EmptyState
          icon="folders"
          title="No projects yet"
          description="Projects hold a board, a task list and stories for your team."
          action={
            <Button variant="primary" onClick={openCreate}>
              New project
            </Button>
          }
        />
      );
    }

    if (visibleProjects.length === 0) {
      return <p className="muted projects-no-match">No matching projects</p>;
    }

    return <div className="row-list">{visibleProjects.map(renderProjectRow)}</div>;
  };

  return (
    <div className="page projects-page">
      <header className="page-header">
        <h1 className="page-title">
          Projects
          <span className="page-title-count">{visibleProjects.length}</span>
        </h1>

        <div className="page-actions">
          <SegmentedControl
            options={accessOptions}
            value={access}
            onChange={setAccess}
            ariaLabel="Filter projects by access"
            size="sm"
          />
          <Checkbox
            className="projects-archived-toggle"
            label="Show archived"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          <Input
            className="projects-search"
            type="search"
            value={search}
            placeholder="Search projects"
            aria-label="Search projects"
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="primary" icon={<Icon name="plus" />} onClick={openCreate}>
            New project
          </Button>
        </div>
      </header>

      <div className="page-body is-narrow">
        {actionError ? (
          <InlineNotice tone="error" className="page-notice" onDismiss={() => setActionError("")}>
            {actionError}
          </InlineNotice>
        ) : null}

        {showInvitations ? (
          <section className="section" aria-labelledby="projects-invitations-title">
            <div className="section-header">
              <h2 className="section-title" id="projects-invitations-title">
                Invitations
              </h2>
              {invitations.length > 0 ? (
                <span className="section-meta">{invitations.length}</span>
              ) : null}
            </div>

            {invitationsLoading ? (
              <p className="muted" role="status">
                Loading invitations…
              </p>
            ) : invitationsError ? (
              <InlineNotice
                tone="error"
                action={
                  <Button size="sm" onClick={onRetryInvitations}>
                    Retry
                  </Button>
                }
              >
                {invitationsError}
              </InlineNotice>
            ) : (
              <div className="row-list">
                {invitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    incoming
                    busy={invitationBusyId === invitation.id}
                    onAccept={(selected) => void respondToInvitation(selected, onAcceptInvitation)}
                    onDecline={(selected) => void respondToInvitation(selected, onDeclineInvitation)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="section projects-list-section">{renderProjects()}</section>
      </div>

      <ProjectDialog
        open={dialogOpen}
        project={editingProject}
        busy={saving}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={submitProject}
      />

      <ConfirmDialog
        open={Boolean(projectToDelete)}
        title={`Delete “${projectToDelete?.name || ""}”?`}
        description="This permanently deletes the project and everything in it."
        confirmLabel="Delete project"
        danger
        busy={deleting}
        onCancel={() => {
          if (deleting) return;
          setProjectToDelete(null);
          setDeleteError("");
        }}
        onConfirm={confirmDelete}
      >
        {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
      </ConfirmDialog>
    </div>
  );
}
