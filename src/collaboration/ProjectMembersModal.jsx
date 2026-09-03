import { useCallback, useEffect, useRef, useState } from "react";
import InvitationRow from "./InvitationRow";
import MemberRow from "./MemberRow";
import {
  Button,
  ConfirmDialog,
  Dialog,
  InlineNotice,
  Input,
  Select,
  Spinner,
} from "../ui";
import { safeDisplayName } from "../domain/identityDomain";
import {
  cancelProjectInvitation,
  createProjectInvitation,
  getProjectInvitations,
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
} from "../application/projectService";

const restoreFocus = (element) => {
  if (!element) return;
  if (typeof window === "undefined" || !window.requestAnimationFrame) {
    element.focus?.();
    return;
  }
  window.requestAnimationFrame(() => element.focus?.());
};

export default function ProjectMembersModal({
  userId,
  project,
  onClose,
  returnFocusElement,
}) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busyId, setBusyId] = useState("");
  const [memberToRemove, setMemberToRemove] = useState(null);
  const removeTriggerRef = useRef(null);
  const roleSaveIdsRef = useRef(new Set());
  const canManage = project.viewerRole === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        getProjectMembers(userId, project.id),
        canManage ? getProjectInvitations(userId, project.id) : Promise.resolve([]),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    } catch (loadError) {
      console.error("Error loading project members:", loadError);
      setError("We couldn't load this project roster. Try again.");
    } finally {
      setLoading(false);
    }
  }, [canManage, project.id, userId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => () => restoreFocus(returnFocusElement), [returnFocusElement]);

  const runAction = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    setActionNotice("");
    try {
      await action();
      await load();
    } catch (actionFailure) {
      console.error("Error updating project access:", actionFailure);
      setActionError(actionFailure?.message || "We couldn't update project access. Try again.");
    } finally {
      setBusyId("");
    }
  };

  const submitInvitation = async (event) => {
    event.preventDefault();
    await runAction("invite", async () => {
      await createProjectInvitation(userId, project.id, {
        email,
        role,
        projectName: project.name,
      });
      setEmail("");
      setRole("editor");
      setActionNotice("Invitation sent.");
    });
  };

  const changeMemberRole = async (member, nextRole) => {
    if (member.role === nextRole || roleSaveIdsRef.current.has(member.userId)) return;
    const previousRole = member.role;

    roleSaveIdsRef.current.add(member.userId);
    setActionError("");
    setMembers((currentMembers) => currentMembers.map((currentMember) =>
      currentMember.userId === member.userId
        ? { ...currentMember, role: nextRole }
        : currentMember
    ));

    try {
      await updateProjectMemberRole(userId, project.id, member.userId, nextRole);
    } catch (roleError) {
      console.error("Error updating project member role:", roleError);
      setMembers((currentMembers) => currentMembers.map((currentMember) =>
        currentMember.userId === member.userId && currentMember.role === nextRole
          ? { ...currentMember, role: previousRole }
          : currentMember
      ));
      setActionError(roleError?.message || "We couldn't update this member's role. Try again.");
    } finally {
      roleSaveIdsRef.current.delete(member.userId);
    }
  };

  const cancelRemoval = () => {
    setMemberToRemove(null);
    restoreFocus(removeTriggerRef.current);
  };

  const confirmRemoval = () => {
    const selected = memberToRemove;
    setMemberToRemove(null);
    void runAction(selected.userId, () => removeProjectMember(userId, project.id, selected.userId));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Members"
      size="md"
      busy={Boolean(busyId)}
      className="members-dialog"
    >
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {actionNotice ? <InlineNotice tone="success">{actionNotice}</InlineNotice> : null}

      {loading ? (
        <p className="members-state" role="status">
          <Spinner size="sm" />
          Loading members…
        </p>
      ) : error ? (
        <InlineNotice
          tone="error"
          action={<Button variant="secondary" size="sm" onClick={load}>Try again</Button>}
        >
          {error}
        </InlineNotice>
      ) : (
        <>
          {canManage ? (
            <form className="member-invite" onSubmit={submitInvitation}>
              <Input
                className="member-invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                aria-label="Invite by email"
                required
                disabled={Boolean(busyId)}
              />
              <Select
                className="member-invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                aria-label="Invitation access"
                disabled={Boolean(busyId)}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </Select>
              <Button
                type="submit"
                variant="primary"
                loading={busyId === "invite"}
                disabled={Boolean(busyId)}
              >
                Invite
              </Button>
            </form>
          ) : null}

          <div className="row-list member-list" aria-label="Project members">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                ownerId={project.ownerId}
                canManage={canManage}
                busy={busyId === member.userId}
                onRoleChange={changeMemberRole}
                onRemove={(selected, triggerElement) => {
                  removeTriggerRef.current = triggerElement;
                  setMemberToRemove(selected);
                }}
              />
            ))}
          </div>

          {canManage && invitations.length > 0 ? (
            <section className="section members-pending">
              <div className="section-header">
                <h3 className="section-title">Pending invitations</h3>
              </div>
              <div className="row-list" aria-label="Project invitations">
                {invitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    busy={busyId === invitation.id}
                    onCancel={(selected) => runAction(
                      selected.id,
                      () => cancelProjectInvitation(userId, project.id, selected.id)
                    )}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onCancel={cancelRemoval}
        onConfirm={confirmRemoval}
        title="Remove member?"
        description={memberToRemove
          ? `${safeDisplayName(memberToRemove)} loses access to ${project.name}.`
          : ""}
        confirmLabel="Remove"
        danger
      />
    </Dialog>
  );
}
