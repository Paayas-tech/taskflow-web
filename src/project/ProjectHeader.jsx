import { useRef, useState } from "react";
import ProjectMembersModal from "../collaboration/ProjectMembersModal";
import ProjectDialog from "../projects/ProjectDialog";
import { AvatarStack } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { Icon } from "../ui/icons";
import { InlineNotice } from "../ui/InlineNotice";
import { Menu } from "../ui/Menu";
import { Tabs } from "../ui/Tabs";
import { safeDisplayName } from "../domain/identityDomain";

const tabItems = (storyCount) => [
  { id: "overview", label: "Overview", icon: <Icon name="layers" size={14} /> },
  { id: "board", label: "Board", icon: <Icon name="layout-board" size={14} /> },
  { id: "list", label: "List", icon: <Icon name="list" size={14} /> },
  { id: "stories", label: "Stories", icon: <Icon name="book" size={14} />, count: storyCount },
];

const copyWorkspaceLink = () => {
  const href = globalThis.location?.href;
  if (!href) return;
  void globalThis.navigator?.clipboard?.writeText?.(href);
};

/**
 * Identity, members, owner actions and the section tabs for one project
 * workspace. Owns the surfaces it opens: members modal, edit dialog and the
 * delete confirmation.
 */
export function ProjectHeader({
  userId,
  project,
  members = [],
  stories = [],
  tab = "overview",
  onTabChange,
  canEdit = false,
  onNewTask,
  onNewStory,
  onUpdateProject,
  onDeleteProject,
  onBack,
}) {
  const [showMembers, setShowMembers] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const membersButtonRef = useRef(null);

  const isOwner = project?.viewerRole === "owner";
  const archived = project?.status === "archived";
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
    setActionError("");
    try {
      await onUpdateProject?.(project.id, { status });
    } catch (error) {
      setActionError(
        error?.message || "We couldn't update this project. Check your connection and try again."
      );
    } finally {
      setStatusBusy(false);
    }
  };

  const submitEdit = async (values) => {
    setEditBusy(true);
    setEditError("");
    try {
      await onUpdateProject?.(project.id, values);
      setEditing(false);
    } catch (error) {
      setEditError(
        error?.message || "We couldn't save this project. Check your connection and try again."
      );
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setActionError("");
    try {
      await onDeleteProject?.(project.id);
      setConfirmingDelete(false);
      onBack?.();
    } catch (error) {
      setActionError(
        error?.message || "We couldn't delete this project. Check your connection and try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  const menuItems = [
    isOwner
      ? {
          id: "edit",
          label: "Edit project",
          icon: <Icon name="edit" />,
          disabled: statusBusy,
          onSelect: () => {
            setEditError("");
            setEditing(true);
          },
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

  const onStories = tab === "stories";

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
          onChange={onTabChange}
          ariaLabel="Project sections"
        />
        <div className="toolbar-spacer" />
        {canEdit ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="plus" size={14} />}
            onClick={onStories ? onNewStory : onNewTask}
          >
            {onStories ? "New story" : "New task"}
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <div className="page-notice workspace-head-notice">
          <InlineNotice tone="error" onDismiss={() => setActionError("")}>
            {actionError}
          </InlineNotice>
        </div>
      ) : null}

      {showMembers ? (
        <ProjectMembersModal
          userId={userId}
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
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default ProjectHeader;
