/**
 * Who can see a project, and who has been invited. The roster is store data
 * (loaded once per session with the projects), so it is read with a selector
 * and re-read through `refreshMembers` after every change; pending invitations
 * are owner-only and are fetched here through the store's api.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { InvitationRow, MemberRow } from "./rows";
import {
  Button,
  ConfirmDialog,
  Dialog,
  InlineNotice,
  Input,
  Select,
  Spinner,
} from "../ui";
import { safeDisplayName } from "../domain/collaboration";
import { refreshMembers } from "../store/projects";
import { selectUser, selectWorkspace } from "../store/selectors";
import { api, useStore } from "../store/store";

const ROSTER_ERROR = "We couldn't load this project roster. Try again.";

const restoreFocus = (element) => {
  if (!element) return;
  if (typeof window === "undefined" || !window.requestAnimationFrame) {
    element.focus?.();
    return;
  }
  window.requestAnimationFrame(() => element.focus?.());
};

export function ProjectMembersModal({ project, onClose, returnFocusElement }) {
  const user = useStore(selectUser);
  const { members } = useStore(selectWorkspace(project.id));
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

  const canManage = project.viewerRole === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInvitations(canManage ? await api().listProjectInvitations(project.id) : []);
    } catch {
      setError(ROSTER_ERROR);
    } finally {
      setLoading(false);
    }
  }, [canManage, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => restoreFocus(returnFocusElement), [returnFocusElement]);

  /** Runs one roster mutation, then re-reads both the roster and invitations. */
  const runAction = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    setActionNotice("");
    try {
      await action();
      await Promise.all([refreshMembers(project.id), load()]);
    } catch (failure) {
      setActionError(failure?.message || "We couldn't update project access. Try again.");
    } finally {
      setBusyId("");
    }
  };

  const submitInvitation = async (event) => {
    event.preventDefault();
    await runAction("invite", async () => {
      await api().sendInvitation(project.id, { email, role, projectName: project.name });
      setEmail("");
      setRole("editor");
      setActionNotice("Invitation sent.");
    });
  };

  const changeMemberRole = (member, nextRole) => {
    if (member.role === nextRole) return;
    if (member.userId === user?.id) {
      setActionError("Ownership cannot be changed here.");
      return;
    }
    void runAction(member.userId, () =>
      api().updateMemberRole(project.id, member.userId, nextRole)
    );
  };

  const confirmRemoval = () => {
    const selected = memberToRemove;
    setMemberToRemove(null);
    if (selected.userId === project.ownerId) {
      setActionError("The project owner cannot be removed.");
      return;
    }
    void runAction(selected.userId, () => api().removeMember(project.id, selected.userId));
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
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Try again
            </Button>
          }
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
                    onCancel={(selected) =>
                      void runAction(selected.id, () =>
                        api().cancelInvitation(project.id, selected.id)
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onCancel={() => {
          setMemberToRemove(null);
          restoreFocus(removeTriggerRef.current);
        }}
        onConfirm={confirmRemoval}
        title="Remove member?"
        description={
          memberToRemove
            ? `${safeDisplayName(memberToRemove)} loses access to ${project.name}.`
            : ""
        }
        confirmLabel="Remove"
        danger
      />
    </Dialog>
  );
}
