/**
 * Every project I can see, plus the invitations waiting for an answer. All of
 * it is store data; the page owns only its filters and the dialogs it opens.
 */
import { useEffect, useState } from "react";
import { InvitationRow } from "../collaboration/rows";
import { ProjectDialog } from "../project/ProjectDialog";
import { Badge, EmptyState, InlineNotice, SegmentedControl, cx } from "../ui/primitives";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { Checkbox, Input } from "../ui/Field";
import { Icon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import { taskTimestampToMillis } from "../domain/task";
import { readProjectTab } from "../lib/preferences";
import { loadInvitations, loadProjects } from "../store/session";
import {
  acceptInvitation,
  createProject,
  declineInvitation,
  deleteProject,
  ensureWorkspace,
  updateProject,
} from "../store/projects";
import { consumeProjectCreateRequest, setProjectTab } from "../store/ui";
import {
  selectErrors,
  selectInvitations,
  selectLoaded,
  selectProjectCreateRequest,
  selectProjects,
  selectUser,
} from "../store/selectors";
import { useStore } from "../store/store";

const accessOptions = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "shared", label: "Shared" },
];

const roleLabels = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

const CREATE_ERROR =
  "We couldn't create this project. Check your connection and try again.";
const SAVE_ERROR = "We couldn't save this project. Check your connection and try again.";
const DELETE_ERROR =
  "We couldn't delete this project. Check your connection and try again.";

const stopPointer = (event) => event.stopPropagation();

const stopKeys = (event) => {
  if (event.key === " " || event.key === "Enter") event.stopPropagation();
};

const isOwnedBy = (project, userId) =>
  project.viewerRole === "owner" || (Boolean(userId) && project.ownerId === userId);

const isArchivedProject = (project) => project.status === "archived";

/** `Updated 3 Sep` (with the year when it is not the current one). */
const formatUpdatedLabel = (project) => {
  const millis = taskTimestampToMillis(project?.updatedAt ?? project?.createdAt);
  if (millis === null) return "";

  const date = new Date(millis);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const formatted = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);

  return `Updated ${formatted}`;
};

const retryNotice = (message, retry) => (
  <InlineNotice
    tone="error"
    action={
      <Button size="sm" onClick={() => void retry()}>
        Retry
      </Button>
    }
  >
    {message}
  </InlineNotice>
);

/** Pure filter behind the search box, the access segments and `Show archived`. */
const filterProjects = (projects, { userId, access, search, showArchived }) => {
  const query = String(search || "").trim().toLowerCase();

  return projects.filter((project) => {
    if (!showArchived && isArchivedProject(project)) return false;

    const owned = isOwnedBy(project, userId);
    if (access === "mine" && !owned) return false;
    if (access === "shared" && owned) return false;

    if (!query) return true;
    return `${project.name || ""} ${project.description || ""}`
      .toLowerCase()
      .includes(query);
  });
};

export function ProjectsPage() {
  const user = useStore(selectUser);
  const projects = useStore(selectProjects);
  const invitations = useStore(selectInvitations);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const createRequest = useStore(selectProjectCreateRequest);

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
  const [invitationBusyId, setInvitationBusyId] = useState("");

  const openDialog = (project = null) => {
    setEditingProject(project);
    setDialogError("");
    setDialogOpen(true);
  };

  // "New project" from elsewhere navigates here first, so the request is
  // already pending on this page's very first render: any non-zero counter
  // opens the dialog, exactly like the profile request on the settings page.
  useEffect(() => {
    if (!createRequest) return;
    openDialog();
    consumeProjectCreateRequest();
  }, [createRequest]);

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

    const saved = editingProject
      ? await updateProject(editingProject.id, values)
      : await createProject(values);

    setSaving(false);
    if (!saved) {
      setDialogError(editingProject ? SAVE_ERROR : CREATE_ERROR);
      return;
    }
    setDialogOpen(false);
    setEditingProject(null);
  };

  const toggleArchive = async (project) => {
    if (actionId) return;
    setActionId(project.id);
    await updateProject(project.id, {
      status: isArchivedProject(project) ? "active" : "archived",
    });
    setActionId("");
  };

  const confirmDelete = async () => {
    if (!projectToDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");

    const removed = await deleteProject(projectToDelete.id);
    setDeleting(false);
    if (removed) setProjectToDelete(null);
    else setDeleteError(DELETE_ERROR);
  };

  const respondToInvitation = async (invitation, respond) => {
    if (invitationBusyId) return;
    setInvitationBusyId(invitation.id);
    await respond(invitation.id);
    setInvitationBusyId("");
  };

  const openProject = (projectId) =>
    setProjectTab(projectId, readProjectTab(projectId));

  const visibleProjects = filterProjects(projects, { userId: user?.id, access, search, showArchived });
  const showInvitations =
    loaded.invitations === "loading" || Boolean(errors.invitations) || invitations.length > 0;

  const renderProjectRow = (project) => {
    const owner = isOwnedBy(project, user?.id);
    const archived = isArchivedProject(project);
    const roleLabel = roleLabels[project.viewerRole] || (owner ? "Owner" : "Member");
    const updatedLabel = formatUpdatedLabel(project);
    const menuItems = [
      {
        id: "open",
        label: "Open",
        icon: <Icon name="external-link" />,
        onSelect: () => openProject(project.id),
      },
      owner && {
        id: "edit",
        label: "Edit",
        icon: <Icon name="edit" />,
        onSelect: () => openDialog(project),
      },
      owner && {
        id: "archive",
        label: archived ? "Restore" : "Archive",
        icon: <Icon name={archived ? "archive-restore" : "archive"} />,
        disabled: actionId === project.id,
        onSelect: () => void toggleArchive(project),
      },
      owner && {
        id: "delete",
        label: "Delete",
        icon: <Icon name="trash" />,
        danger: true,
        onSelect: () => {
          setDeleteError("");
          setProjectToDelete(project);
        },
      },
    ].filter(Boolean);

    // Hovering a row warms its workspace: a cache hit costs nothing.
    const prefetch = () => void ensureWorkspace(project.id);

    return (
      <div
        key={project.id}
        className={cx("project-row", archived && "is-archived")}
        role="button"
        tabIndex={0}
        aria-label={`Open ${project.name}`}
        aria-busy={actionId === project.id || undefined}
        onClick={() => openProject(project.id)}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openProject(project.id);
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
          {updatedLabel ? (
            <span className="project-row-updated">{updatedLabel}</span>
          ) : null}
          <span className="project-row-menu" onClick={stopPointer} onKeyDown={stopKeys}>
            <Menu
              align="end"
              items={menuItems}
              trigger={(triggerProps) => (
                <IconButton
                  label={`More actions for ${project.name}`}
                  size="sm"
                  {...triggerProps}
                >
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
    if (loaded.projects === "loading" && projects.length === 0) {
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

    if (errors.projects) return retryNotice(errors.projects, loadProjects);

    if (projects.length === 0) {
      return (
        <EmptyState
          icon="folders"
          title="No projects yet"
          description="Projects hold a board, a task list and stories for your team."
          action={
            <Button variant="primary" onClick={() => openDialog()}>
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
          <Button variant="primary" icon={<Icon name="plus" />} onClick={() => openDialog()}>
            New project
          </Button>
        </div>
      </header>

      <div className="page-body">
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

            {loaded.invitations === "loading" ? (
              <p className="muted" role="status">
                Loading invitations…
              </p>
            ) : errors.invitations ? (
              retryNotice(errors.invitations, loadInvitations)
            ) : (
              <div className="row-list">
                {invitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    incoming
                    busy={invitationBusyId === invitation.id}
                    onAccept={(selected) => void respondToInvitation(selected, acceptInvitation)}
                    onDecline={(selected) => void respondToInvitation(selected, declineInvitation)}
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
