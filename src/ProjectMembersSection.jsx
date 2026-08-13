import { useCallback, useEffect, useMemo, useState } from "react";
import { withImplicitProjectOwner } from "./domain/projectMemberDomain";
import { getProjectMembers } from "./services/projectService";

export default function ProjectMembersSection({
  ownerId,
  ownerEmail,
  projectId,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    if (!ownerId || !projectId) return;

    setLoading(true);
    setError("");

    try {
      setMembers(await getProjectMembers(ownerId, projectId));
    } catch {
      setMembers([]);
      setError(
        "Member records are unavailable. The project owner is still recognized from this private project path."
      );
    } finally {
      setLoading(false);
    }
  }, [ownerId, projectId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const displayMembers = useMemo(
    () => withImplicitProjectOwner(ownerId, members),
    [members, ownerId]
  );
  const owner = displayMembers[0];
  const additionalMembers = displayMembers.slice(1);

  return (
    <section className="project-members-section" aria-labelledby="project-members-title">
      <header className="project-members-header">
        <div>
          <p className="card-label">Access</p>
          <h3 id="project-members-title">Project members</h3>
          <p>Membership is private to this project owner in this phase.</p>
        </div>
        <span>{displayMembers.length}</span>
      </header>

      <div className="project-member-list">
        <div className="project-member-row">
          <span className="project-member-avatar" aria-hidden="true">
            {(ownerEmail || owner.userId)[0]?.toUpperCase() || "O"}
          </span>
          <div className="project-member-copy">
            <strong>{ownerEmail || "Current project owner"}</strong>
            <span>{owner.implicit ? "Owner · implicit membership" : "Owner"}</span>
          </div>
          <span className="project-member-role">Owner</span>
        </div>

        {additionalMembers.map((member) => (
          <div className="project-member-row" key={member.id}>
            <span className="project-member-avatar" aria-hidden="true">
              {member.userId[0]?.toUpperCase() || "M"}
            </span>
            <div className="project-member-copy">
              <strong>{member.userId}</strong>
              <span>Active member</span>
            </div>
            <span className="project-member-role">Member</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="project-members-feedback" role="status" aria-live="polite">
          <span className="state-spinner" aria-hidden="true" />
          <p>Loading explicit member records...</p>
        </div>
      ) : error ? (
        <div className="project-members-feedback project-members-error" role="alert">
          <p>{error}</p>
          <button className="ghost-btn compact-btn" type="button" onClick={loadMembers}>
            Try again
          </button>
        </div>
      ) : additionalMembers.length === 0 ? (
        <p className="project-members-empty">No additional members yet.</p>
      ) : null}

      <p className="project-members-note">
        Invitations and member management are not available yet.
      </p>
    </section>
  );
}
