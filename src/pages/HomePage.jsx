import { useMemo, useState } from "react";
import InvitationRow from "../collaboration/InvitationRow";
import { dateOnlyKey } from "../domain/taskDomain";
import AssignedWidget from "../home/AssignedWidget";
import InboxWidget from "../home/InboxWidget";
import MyTasksWidget from "../home/MyTasksWidget";
import ProjectsWidget from "../home/ProjectsWidget";
import { activeProjects, homeTaskBuckets } from "../home/homeData";
import { Button, Icon, InlineNotice } from "../ui";

const greetingFor = (hour) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const firstNameOf = (displayName) =>
  String(displayName || "")
    .trim()
    .split(/\s+/)[0] || "";

const longDate = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

const plural = (count, singular) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

/** The dashboard: greeting, invitations and the four widgets. */
export function HomePage({
  userId,
  displayName,
  now = new Date(),
  tasks = [],
  tasksLoading = false,
  tasksError = "",
  onRetryTasks,
  projects = [],
  projectsLoading = false,
  projectsError = "",
  onRetryProjects,
  invitations = [],
  onAcceptInvitation,
  onDeclineInvitation,
  notifications = [],
  notificationsLoading = false,
  taskActions,
  onOpenTask,
  onOpenProject,
  selectedTaskId = null,
  onNewTask,
  onNewProject,
  onNavigate,
  formatSettings,
}) {
  const [invitationBusyId, setInvitationBusyId] = useState("");
  const [invitationError, setInvitationError] = useState("");

  const todayKey = dateOnlyKey(now);
  const context = useMemo(
    () => ({ projectsById: new Map(projects.map((project) => [project.id, project])) }),
    [projects]
  );
  const buckets = useMemo(() => homeTaskBuckets(tasks, todayKey), [tasks, todayKey]);
  const projectCount = useMemo(() => activeProjects(projects).length, [projects]);

  const firstName = firstNameOf(displayName);
  const greeting = `${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ""}`;
  const summary = [
    buckets.today.length ? `${buckets.today.length} due today` : null,
    buckets.overdue.length ? `${buckets.overdue.length} overdue` : null,
    projectCount ? plural(projectCount, "project") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const respondToInvitation = async (invitation, action) => {
    if (!action || invitationBusyId) return;
    setInvitationBusyId(invitation.id);
    setInvitationError("");
    try {
      await action(invitation.id);
    } catch (error) {
      setInvitationError(
        error?.message || "We couldn't update that invitation. Try again."
      );
    } finally {
      setInvitationBusyId("");
    }
  };

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div className="home-greeting">
          <h1 className="page-title home-greeting-title">{greeting}</h1>
          <p className="home-greeting-meta">
            <time dateTime={todayKey}>{longDate(now)}</time>
            {summary ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="home-summary">{summary}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Icon name="plus" />}
            onClick={() => onNewTask?.()}
          >
            New task
          </Button>
        </div>
      </header>

      <div className="page-body">
        {invitations.length > 0 ? (
          <InlineNotice tone="info" className="page-notice home-invitations">
            <p className="home-invitations-title">
              {`You have ${plural(invitations.length, "project invitation")}`}
            </p>
            <div className="home-invitation-list">
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  incoming
                  busy={invitationBusyId === invitation.id}
                  onAccept={(item) => respondToInvitation(item, onAcceptInvitation)}
                  onDecline={(item) => respondToInvitation(item, onDeclineInvitation)}
                />
              ))}
            </div>
            {invitationError ? (
              <p className="home-invitation-error" role="alert">
                {invitationError}
              </p>
            ) : null}
          </InlineNotice>
        ) : null}

        <div className="home-grid">
          <div className="home-column">
            <MyTasksWidget
              tasks={tasks}
              loading={tasksLoading}
              error={tasksError}
              onRetry={onRetryTasks}
              context={context}
              taskActions={taskActions}
              onOpenTask={onOpenTask}
              onOpenProject={onOpenProject}
              selectedTaskId={selectedTaskId}
              onNewTask={onNewTask}
              onNavigate={onNavigate}
              todayKey={todayKey}
              formatSettings={formatSettings}
            />
            <AssignedWidget
              tasks={tasks}
              userId={userId}
              loading={tasksLoading}
              error={tasksError}
              onRetry={onRetryTasks}
              context={context}
              taskActions={taskActions}
              onOpenTask={onOpenTask}
              onOpenProject={onOpenProject}
              selectedTaskId={selectedTaskId}
              onNavigate={onNavigate}
              todayKey={todayKey}
              formatSettings={formatSettings}
            />
          </div>
          <div className="home-column">
            <ProjectsWidget
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              onRetry={onRetryProjects}
              onNavigate={onNavigate}
              onNewProject={onNewProject}
            />
            <InboxWidget
              notifications={notifications}
              loading={notificationsLoading}
              onNavigate={onNavigate}
              formatSettings={formatSettings}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
