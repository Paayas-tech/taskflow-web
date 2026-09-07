/**
 * Identity, members, owner actions and the section tabs of one project
 * workspace. Everything it shows comes from the store; it owns only the
 * surfaces it opens: the members modal, the edit dialog and the delete
 * confirmation.
 */
import { useRef, useState } from "react";
import { ProjectDialog } from "./ProjectDialog";
import { ProjectMembersModal } from "../collaboration/ProjectMembersModal";
import { AvatarStack, Badge, Tabs } from "../ui/primitives";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { Icon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import { safeDisplayName } from "../domain/collaboration";
import { deleteProject, updateProject } from "../store/projects";
import { navigate, openComposer, setProjectTab } from "../store/ui";
import { selectWorkspace } from "../store/selectors";
import { useStore } from "../store/store";

// A dialog covers the shell's toast, so its own failures are shown inside it.
const SAVE_ERROR = "We couldn't save this project. Check your connection and try again.";

const tabItems = (storyCount) => [
  { id: "overview", label: "Overview", icon: <Icon name="layers" size={14} /> },
  { id: "board", label: "Board", icon: <Icon name="layout-board" size={14} /> },
  { id: "list", label: "List", icon: <Icon name="list" size={14} /> },
  {
    id: "stories",
    label: "Stories",
    icon: <Icon name="book" size={14} />,
    count: storyCount,
  },
];

const copyWorkspaceLink = () => {
  const href = globalThis.location?.href;
  if (!href) return;
  void globalThis.navigator?.clipboard?.writeText?.(href);
};

export function ProjectHeader({ projectId, tab = "overview", storyId = "" }) {
  const { project, members, stories, canEdit } = useStore(selectWorkspace(projectId));
  const [showMembers, setShowMembers] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const membersButtonRef = useRef(null);

  if (!project) return null;

  const isOwner = project.viewerRole === "owner";
  const archived = project.status === "archived";
  const onStories = tab === "stories";
  const people = members.map((member) => ({
    id: member.userId,
    name: safeDisplayName(member),
    src: member.avatarUrl,
  }));

  const openMembers = (event) => {
    membersButtonRef.current = event?.currentTarget || null;
    setShowMembers(true);
  };

  const changeStatus = async (status) => {
    setStatusBusy(true);
    await updateProject(projectId, { status });
    setStatusBusy(false);
  };

  const openEdit = () => {
    setEditError("");
    setEditing(true);
  };

  const submitEdit = async (values) => {
    setEditBusy(true);
    setEditError("");
    const saved = await updateProject(projectId, values);
    setEditBusy(false);
    if (saved) setEditing(false);
    else setEditError(SAVE_ERROR);
  };

  const confirmDelete = () => {
    // The store drops the project from state before the request settles, which
    // leaves this workspace with nothing to render, so the page goes back to
    // the projects list first. A failure there restores the project and raises
    // the store's notice, which the list shows with no dialog covering it.
    setConfirmingDelete(false);
    navigate("/projects");
    void deleteProject(projectId);
  };

  const newItem = () =>
    openComposer(
      {
        projectId,
        workType: onStories ? "story" : "task",
        storyId: onStories ? "" : storyId,
      },
      { lockProject: true }
    );

  const menuItems = [
    isOwner
      ? {
          id: "edit",
          label: "Edit project",
          icon: <Icon name="edit" />,
          disabled: statusBusy,
          onSelect: openEdit,
        }
      : null,
    isOwner
      ? {
          id: "archive",
          label: archived ? "Restore project" : "Archive project",
          icon: <Icon name={archived ? "archive-restore" : "archive"} />,
          disabled: statusBusy,
          onSelect: () => void changeStatus(archived ? "active" : "archived"),
        }
      : null,
    { id: "copy", label: "Copy link", icon: <Icon name="link" />, onSelect: copyWorkspaceLink },
    isOwner ? { id: "delete-separator", separator: true } : null,
    isOwner
      ? {
          id: "delete",
          label: "Delete project",
          icon: <Icon name="trash" />,
          danger: true,
          onSelect: () => setConfirmingDelete(true),
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="workspace-head">
      <header className="page-header workspace-header">
        <div className="page-title workspace-identity">
          <span
            className="workspace-color"
            style={{ backgroundColor: project.color || "var(--color-accent)" }}
            aria-hidden="true"
          />
          <h1 className="workspace-name truncate">{project.name}</h1>
          {archived ? <Badge tone="neutral">Archived</Badge> : null}
          {canEdit ? null : <Badge tone="neutral">View only</Badge>}
        </div>

        {project.description ? (
          <p className="workspace-description truncate" title={project.description}>
            {project.description}
          </p>
        ) : null}

        <div className="page-actions">
          {people.length > 0 ? (
            <button
              type="button"
              className="workspace-members"
              aria-label={`Members, ${people.length}`}
              onClick={openMembers}
            >
              <AvatarStack people={people} max={3} size="sm" />
            </button>
          ) : null}
          <Button size="sm" onClick={openMembers}>
            {isOwner ? "Invite" : "Members"}
          </Button>
          <Menu
            align="end"
            items={menuItems}
            trigger={(triggerProps) => (
              <IconButton label="Project actions" size="sm" {...triggerProps}>
                <Icon name="more-horizontal" />
              </IconButton>
            )}
          />
        </div>
      </header>

      <div className="workspace-tabbar">
        <Tabs
          items={tabItems(stories.length)}
          value={tab}
          onChange={(next) => setProjectTab(projectId, next)}
          ariaLabel="Project sections"
        />
        <div className="toolbar-spacer" />
        {canEdit ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="plus" size={14} />}
            onClick={newItem}
          >
            {onStories ? "New story" : "New task"}
          </Button>
        ) : null}
      </div>

      {showMembers ? (
        <ProjectMembersModal
          project={project}
          onClose={() => setShowMembers(false)}
          returnFocusElement={membersButtonRef.current}
        />
      ) : null}

      <ProjectDialog
        open={editing}
        project={project}
        busy={editBusy}
        error={editError}
        onClose={() => setEditing(false)}
        onSubmit={submitEdit}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete project?"
        description={`“${project.name}” and everything inside it will be removed. This can't be undone.`}
        confirmLabel="Delete project"
        danger
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
