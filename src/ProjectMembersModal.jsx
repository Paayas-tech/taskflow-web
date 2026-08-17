import { useCallback, useEffect, useRef, useState } from "react";
import InvitationRow from "./InvitationRow";
import MemberRow from "./MemberRow";
import {
  cancelProjectInvitation,
  createProjectInvitation,
  getProjectInvitations,
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
} from "./application/projectService";

export default function ProjectMembersModal({ userId, project, onClose }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busyId, setBusyId] = useState("");
  const [memberToRemove, setMemberToRemove] = useState(null);
  const dialogRef = useRef(null);
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busyId) onClose();
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busyId, onClose]);

  const runAction = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
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
      await createProjectInvitation(userId, project.id, { email, role });
      setEmail("");
      setRole("editor");
    });
  };

  return (
    <div
      className="task-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !busyId && onClose()}
    >
      <section
        ref={dialogRef}
        className="task-modal project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-members-title"
        aria-busy={Boolean(busyId)}
      >
        <div className="task-modal-header">
          <div>
            <p className="card-label">Collaboration</p>
            <h2 id="project-members-title">Project members</h2>
            <p>{project.name} · You are {project.viewerRole || "a member"}.</p>
          </div>
          <button className="ghost-btn compact-btn" type="button" onClick={onClose} disabled={Boolean(busyId)}>Close</button>
        </div>

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {loading ? (
          <div className="projects-state" role="status"><div className="state-spinner" /><p>Loading members...</p></div>
        ) : error ? (
          <div className="projects-state error-state" role="alert"><p>{error}</p><button className="ghost-btn" type="button" onClick={load}>Try again</button></div>
        ) : (
          <>
            <div className="projects-grid" aria-label="Project members">
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  ownerId={project.ownerId}
                  canManage={canManage}
                  busy={busyId === member.userId}
                  onRoleChange={(selected, nextRole) => runAction(
                    selected.userId,
                    () => updateProjectMemberRole(userId, project.id, selected.userId, nextRole)
                  )}
                  onRemove={setMemberToRemove}
                />
              ))}
            </div>

            {canManage && (
              <>
                <form className="project-form" onSubmit={submitInvitation}>
                  <label className="project-form-field">
                    <span>Invite by email</span>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={Boolean(busyId)} />
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
                <p className="project-description">Invitations appear inside TaskFlow. External email delivery is not enabled in this phase.</p>
                {invitations.length > 0 && (
                  <div className="projects-grid" aria-label="Project invitations">
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
            <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-member-title">
              <h3 id="remove-member-title">Remove this member?</h3>
              <p>{memberToRemove.userId} will immediately lose access to this project.</p>
              <div className="confirmation-actions">
                <button className="ghost-btn" type="button" onClick={() => setMemberToRemove(null)}>Cancel</button>
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
