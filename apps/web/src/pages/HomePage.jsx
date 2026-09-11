import { useMemo, useState } from "react";
import { InvitationRow } from "../collaboration/rows";
import { dateOnlyKey } from "../domain/task";
import {
  AssignedWidget,
  InboxWidget,
  MyTasksWidget,
  ProjectsWidget,
} from "../home/HomeWidgets";
import { effectiveMyDayDate, homeTaskBuckets } from "../home/homeData";
import { acceptInvitation, declineInvitation } from "../store/projects";
import {
  selectActiveProjects,
  selectInvitations,
  selectMyTasks,
  selectSettings,
  selectUser,
} from "../store/selectors";
import { useStore } from "../store/store";
import { openComposer } from "../store/ui";
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
export function HomePage() {
  const user = useStore(selectUser);
  const tasks = useStore(selectMyTasks);
  const projects = useStore(selectActiveProjects);
  const invitations = useStore(selectInvitations);
  const settings = useStore(selectSettings);
  const [invitationBusyId, setInvitationBusyId] = useState("");

  // "My day" can start later than midnight, and until it does the previous
  // calendar day is still today for the greeting and the task buckets.
  const now = useMemo(
    () => effectiveMyDayDate(new Date(), settings.myDay),
    [settings.myDay]
  );
  const todayKey = useMemo(() => dateOnlyKey(now), [now]);
  const buckets = useMemo(() => homeTaskBuckets(tasks, todayKey), [tasks, todayKey]);

  const firstName = firstNameOf(user?.displayName);
  const greeting = `${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ""}`;
  const summary = [
    buckets.today.length ? `${buckets.today.length} due today` : null,
    buckets.overdue.length ? `${buckets.overdue.length} overdue` : null,
    projects.length ? plural(projects.length, "project") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const respondToInvitation = async (invitation, respond) => {
    if (invitationBusyId) return;
    setInvitationBusyId(invitation.id);
    await respond(invitation.id);
    setInvitationBusyId("");
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
            onClick={() => openComposer()}
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
                  onAccept={(item) => respondToInvitation(item, acceptInvitation)}
                  onDecline={(item) => respondToInvitation(item, declineInvitation)}
                />
              ))}
            </div>
          </InlineNotice>
        ) : null}

        <div className="home-grid">
          <div className="home-column">
            <MyTasksWidget />
            <AssignedWidget />
          </div>
          <div className="home-column">
            <ProjectsWidget />
            <InboxWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
