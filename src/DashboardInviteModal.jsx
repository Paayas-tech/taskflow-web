import { useMemo, useRef, useState } from "react";
import { createProjectInvitation } from "./application/projectService";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";

const invitationEmails = (value) => [...new Set(String(value || "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];

export default function DashboardInviteModal({ userId, projects = [], onClose }) {
  const manageableProjects = useMemo(() => projects.filter((project) => project.viewerRole === "owner" && project.status !== "archived"), [projects]);
  const [emails, setEmails] = useState("");
  const [projectId, setProjectId] = useState(manageableProjects[0]?.id || "");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const { onBackdropMouseDown } = useModalLifecycle({ isOpen: true, modalRef: dialogRef, onClose, isDismissDisabled: busy });

  const submit = async (event) => {
    event.preventDefault();
    const recipients = invitationEmails(emails);
    const project = manageableProjects.find((item) => item.id === projectId);
    if (!project || !recipients.length) return;
    setBusy(true);
    setError("");
    try {
      for (const email of recipients) {
        await createProjectInvitation(userId, project.id, { email, role, projectName: project.name });
      }
      onClose();
    } catch (failure) {
      console.error("Error sending dashboard invitations:", failure);
      setError(failure?.message || "We couldn't send the invitation. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="task-modal-backdrop dashboard-invite-backdrop" onMouseDown={onBackdropMouseDown}>
    <section ref={dialogRef} className="dashboard-invite-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-invite-title" aria-busy={busy} tabIndex={-1}>
      <header><div><p className="card-label">Collaboration</p><h2 id="dashboard-invite-title">Invite people</h2><p>Add teammates to a project by email.</p></div><button type="button" className="icon-btn" aria-label="Close invitation dialog" onClick={onClose} disabled={busy}>×</button></header>
      {manageableProjects.length ? <form onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label><span>Email addresses</span><textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="name@example.com, teammate@example.com" required disabled={busy} /><small>Separate multiple addresses with commas.</small></label>
        <div className="dashboard-invite-fields"><label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={busy}>{manageableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Access</span><select value={role} onChange={(event) => setRole(event.target.value)} disabled={busy}><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label></div>
        <p className="dashboard-invite-help">Invitees receive an email and can accept after signing in with that address.</p>
        <footer><button className="ghost-btn" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-btn" type="submit" disabled={busy || !emails.trim() || !projectId}>{busy ? "Sending…" : "Send invitation"}</button></footer>
      </form> : <div className="dashboard-card-empty"><strong>No manageable projects</strong><span>Create or own a project before inviting teammates.</span><button className="ghost-btn" type="button" onClick={onClose}>Close</button></div>}
    </section>
  </div>;
}
