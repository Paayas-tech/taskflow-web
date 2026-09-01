import { useCallback, useEffect, useRef, useState } from "react";
import InvitationRow from "./InvitationRow";
import MemberRow from "./MemberRow";
import { safeDisplayName } from "./domain/identityDomain";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";
import {
  cancelProjectInvitation,
  createProjectInvitation,
  getProjectInvitations,
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
} from "./application/projectService";

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
  const dialogRef = useRef(null);
  const confirmationDialogRef = useRef(null);
  const removeTriggerRef = useRef(null);
  const busyIdRef = useRef("");
  const roleSaveIdsRef = useRef(new Set());
  const canManage = project.viewerRole === "owner";

  busyIdRef.current = busyId;

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

  useEffect(() => {
    if (!memberToRemove) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busyIdRef.current) {
        setMemberToRemove(null);
        window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const activeDialog = confirmationDialogRef.current;
      const elements = activeDialog?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!elements?.length) {
        event.preventDefault();
        activeDialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === activeDialog)
      ) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(() => {
      confirmationDialogRef.current
        ?.querySelector('button:not(:disabled)')
        ?.focus();
    });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [memberToRemove]);

  useEffect(() => {
    return () => {
      window.requestAnimationFrame(() => returnFocusElement?.focus());
    };
  }, [returnFocusElement]);

  const { onBackdropMouseDown } = useModalLifecycle({
    isOpen: true,
    modalRef: dialogRef,
    onClose,
    isDismissDisabled: Boolean(busyId),
    allowEscape: !memberToRemove,
    trapFocus: !memberToRemove,
    restoreFocus: false,
  });

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

  return (
    <div
      className="task-modal-backdrop"
      onMouseDown={onBackdropMouseDown}
    >
      <section
        ref={dialogRef}
        className="task-modal project-modal project-members-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-members-title"
        aria-busy={Boolean(busyId)}
        tabIndex={-1}
      >
        <div className="task-modal-header">
          <div>
            <p className="card-label">Collaboration</p>
            <h2 id="project-members-title">Project members</h2>
            <p>{project.name} · {project.viewerRole || "Member"}</p>
          </div>
          <button className="ghost-btn compact-btn" type="button" onClick={onClose} disabled={Boolean(busyId)}>Close</button>
        </div>

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionNotice && <p className="form-success" role="status">{actionNotice}</p>}
        {loading ? (
          <div className="projects-state" role="status"><div className="state-spinner" /><p>Loading members...</p></div>
        ) : error ? (
          <div className="projects-state error-state" role="alert"><p>{error}</p><button className="ghost-btn" type="button" onClick={load}>Try again</button></div>
        ) : (
          <>
            <div className="projects-grid project-members-grid" aria-label="Project members">
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  ownerId={project.ownerId}
                  canManage={canManage}
                  busy={busyId === member.userId}
                  onRoleChange={changeMemberRole}
                  onRemove={(member, triggerElement) => {
                    removeTriggerRef.current = triggerElement;
                    setMemberToRemove(member);
                  }}
                />
              ))}
            </div>

            {canManage && (
              <>
                <section className="project-invite-section" aria-labelledby="project-invite-title">
                <div className="project-invite-heading">
                  <div>
                    <h3 id="project-invite-title">Invite a teammate</h3>
                    <p>Invite by email.</p>
                  </div>
                </div>
                <form className="project-form project-invite-form" onSubmit={submitInvitation}>
                  <label className="project-form-field">
                    <span>Invite by email</span>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required disabled={Boolean(busyId)} />
                  </label>
                  <label className="project-form-field">
                    <span>Access</span>
                    <select value={role} onChange={(event) => setRole(event.target.value)} disabled={Boolean(busyId)}>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <div className="project-form-actions">
                    <button className="primary-btn" type="submit" disabled={Boolean(busyId)}>{busyId === "invite" ? "Sending..." : "Send invitation"}</button>
                  </div>
                </form>
                <p className="project-invite-note">They must sign in with this address.</p>
                </section>
                {invitations.length > 0 && (
                  <div className="projects-grid project-invitations-grid" aria-label="Project invitations">
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
                )}
              </>
            )}
          </>
        )}

        {memberToRemove && (
          <div className="confirmation-backdrop">
            <section ref={confirmationDialogRef} className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-member-title" tabIndex={-1}>
              <h3 id="remove-member-title">Remove this member?</h3>
              <p>Remove {safeDisplayName(memberToRemove)} from this project?</p>
              <div className="confirmation-actions">
                <button className="ghost-btn" type="button" onClick={() => { setMemberToRemove(null); window.requestAnimationFrame(() => removeTriggerRef.current?.focus()); }}>Cancel</button>
                <button className="danger-btn" type="button" onClick={() => {
                  const selected = memberToRemove;
                  setMemberToRemove(null);
                  void runAction(selected.userId, () => removeProjectMember(userId, project.id, selected.userId));
                }}>Remove member</button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
