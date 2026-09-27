/**
 * An in-memory implementation of the `src/api` contract for tests. Store tests
 * drive real actions against it; page tests render against a store seeded
 * through it.
 *
 *   const api = createFakeApi({ tasks: [makeTask({ title: "Ship it" })] });
 *   api.failNext("updateTask", new Error("offline"));  // the next call rejects
 *   api.calls;                                         // [["updateTask", id, patch], …]
 *   api.emit("notifications");                         // fire a realtime callback
 */
import { normalizeSettings } from "../domain/settings";

let sequence = 0;
const nextId = (prefix) => `${prefix}-${++sequence}`;
const nowIso = () => new Date().toISOString();
const copy = (row) => ({ ...row });
const lower = (value) => String(value || "").toLowerCase();

/* -------------------------------------------------------------------------
 * Builders
 * ---------------------------------------------------------------------- */

/** A `make*` builder: defaults, then overrides, with a fresh id if none given. */
const builder =
  (prefix, defaults) =>
  (overrides = {}) => ({
    ...defaults,
    ...overrides,
    id: overrides.id || nextId(prefix),
  });

export const makeUser = (overrides = {}) => {
  const { id: overrideId, uid: overrideUid, ...rest } = overrides;
  const id = overrideId || overrideUid || "user-1";
  return {
    email: "sam@example.com",
    displayName: "Sam Rivera",
    onboardingRequired: false,
    ...rest,
    id,
    uid: id,
  };
};

export const makeProject = builder("project", {
  ownerId: "user-1",
  name: "Website relaunch",
  description: "",
  color: "",
  status: "active",
  healthStatus: "on_track",
  dueDate: "",
  archivedAt: null,
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
  viewerRole: "owner",
  healthSupported: true,
});

export const makeTask = builder("task", {
  projectId: null,
  workType: "task",
  storyId: null,
  title: "Write the brief",
  description: "",
  notes: "",
  status: "todo",
  completed: false,
  priority: "medium",
  dueDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  reminder: false,
  reminderAt: "",
  columnId: null,
  position: null,
  assigneeId: null,
  archivedAt: null,
  completedAt: null,
  createdBy: "user-1",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
});

export const makeColumn = builder("column", {
  projectId: "project-1",
  name: "To Do",
  category: "todo",
  position: 0,
  isTerminal: false,
});

const DEFAULT_COLUMNS = [
  { name: "To Do", category: "todo", position: 0 },
  { name: "In Progress", category: "in_progress", position: 1 },
  { name: "Done", category: "done", position: 2, isTerminal: true },
];

const defaultColumnsFor = (projectId) =>
  DEFAULT_COLUMNS.map((column) => makeColumn({ ...column, projectId }));

/* -------------------------------------------------------------------------
 * The fake
 * ---------------------------------------------------------------------- */

const APP_STATUS = { done: "completed", in_progress: "in-progress" };

/** Mirrors the `normalize_task_completion` trigger. */
const withCompletion = (task) => {
  const status = APP_STATUS[task.status] || task.status || "todo";
  const completed = status === "completed";
  return {
    ...task,
    status,
    completed,
    completedAt: completed ? task.completedAt || nowIso() : null,
  };
};

export const createFakeApi = (seed = {}) => {
  const data = {
    user: seed.user ? makeUser(seed.user) : null,
    tasks: [...(seed.tasks || [])],
    projects: [...(seed.projects || [])],
    columns: [...(seed.columns || [])],
    members: [...(seed.members || [])],
    profiles: [...(seed.profiles || [])],
    invitations: [...(seed.invitations || [])],
    notifications: [...(seed.notifications || [])],
    comments: [...(seed.comments || [])],
    activity: [...(seed.activity || [])],
    attachments: [...(seed.attachments || [])],
    settings: seed.settings || null,
    googleConnection: seed.googleConnection || null,
    googleEvents: seed.googleEvents || [],
  };

  const calls = [];
  const failures = new Map();
  const channels = new Map();

  const record = (name, args) => {
    calls.push([name, ...args]);
    const queued = failures.get(name);
    if (!queued?.length) return;
    const failure = queued.shift();
    throw failure instanceof Error
      ? failure
      : new Error(String(failure || `${name} failed.`));
  };

  const api = {};

  /** Defines one asynchronous api function. */
  const define = (name, implementation) => {
    api[name] = async (...args) => {
      record(name, args);
      await Promise.resolve();
      return implementation(...args);
    };
  };

  /** Defines a subscription: synchronous, returns an unsubscribe function. */
  const defineChannel = (name, channelOf) => {
    api[name] = (...args) => {
      record(name, args);
      const channel = channelOf(...args);
      const onChange = args.find((argument) => typeof argument === "function");
      const listeners = channels.get(channel) || new Set();
      listeners.add(onChange);
      channels.set(channel, listeners);
      return () => listeners.delete(onChange);
    };
  };

  /**
   * CRUD over one of the `data` arrays. Reads hand out copies, the way a real
   * request would; `missing` is the message a lookup miss raises, matching what
   * the api it stands in for reports.
   */
  const collection = (key, missing) => {
    const rows = () => data[key];
    const self = {
      find: (id) => rows().find((row) => row.id === id),
      list: (matches = () => true) => rows().filter(matches).map(copy),
      insert: (row) => {
        rows().push(row);
        return copy(row);
      },
      require: (id) => {
        const row = self.find(id);
        if (!row) throw new Error(missing);
        return row;
      },
      /** Swaps the row `matches` selects for `next(row)`. */
      replace: (matches, next) => {
        const row = rows().find(matches);
        if (!row) throw new Error(missing);
        const merged = next(row);
        data[key] = rows().map((candidate) =>
          candidate === row ? merged : candidate
        );
        return copy(merged);
      },
      update: (id, next) => self.replace((row) => row.id === id, next),
      drop: (matches) => {
        data[key] = rows().filter((row) => !matches(row));
      },
      remove: (id) => self.drop((row) => row.id === id),
    };
    return self;
  };

  const tasks = collection("tasks", "The selected task is unavailable.");
  const projects = collection("projects", "The selected project is unavailable.");
  const columns = collection("columns");
  const members = collection("members", "This member is no longer available.");
  const invitations = collection("invitations", "This invitation is no longer available.");
  const comments = collection("comments", "This comment is no longer available.");
  const activity = collection("activity");
  const notifications = collection("notifications", "This notification is no longer available.");
  const attachments = collection("attachments");

  /** `list*` by one field, the shape most of the read endpoints have. */
  const listBy = (source, field) => (value) =>
    source.list((row) => row[field] === value);

  const profileFor = (userId) =>
    data.profiles.find((profile) => profile.userId === userId) || null;

  /** The membership row the database trigger writes for a new member. */
  const memberRow = (projectId, userId, role) => ({
    projectId,
    userId,
    role,
    joinedAt: nowIso(),
    displayName: profileFor(userId)?.displayName || "",
    avatarUrl: null,
  });

  /* ---------------------------------------------------------------- auth */

  define("normalizeAuthUser", (user) => (user ? makeUser(user) : null));
  define("signUp", (email, password, displayName) => {
    data.user = makeUser({ email, displayName });
    return { user: data.user, confirmationRequired: false };
  });
  define("resendConfirmation", () => ({ success: true }));
  define("verifySignupOtp", () => data.user);
  define("signIn", (email) => {
    data.user = data.user || makeUser({ email });
    return data.user;
  });
  define("requestPasswordReset", () => ({ success: true }));
  define("updatePassword", () => ({ success: true }));
  define("signOut", () => {
    data.user = null;
  });
  define("getUser", () => data.user);
  define("updateDisplayName", (displayName) => {
    if (data.user) data.user = { ...data.user, displayName };
    return data.user;
  });
  define("completeOnboarding", () => {
    if (data.user) data.user = { ...data.user, onboardingRequired: false };
    return data.user;
  });
  define("deleteAccount", () => {
    data.user = null;
  });
  api.onAuthStateChange = (callback) => {
    record("onAuthStateChange", []);
    const listeners = channels.get("auth") || new Set();
    listeners.add(callback);
    channels.set("auth", listeners);
    return () => listeners.delete(callback);
  };

  /* --------------------------------------------------------------- tasks */

  define("listPersonalTasks", () => tasks.list((task) => !task.projectId));
  define("listAssignedTasks", (userId) =>
    tasks.list((task) => Boolean(task.projectId) && task.assigneeId === userId)
  );
  define("listProjectTasks", listBy(tasks, "projectId"));
  define("createTask", (values = {}) =>
    tasks.insert(withCompletion(makeTask(values)))
  );
  define("updateTask", (taskId, patch = {}) =>
    tasks.update(taskId, (task) =>
      withCompletion({ ...task, ...patch, updatedAt: nowIso() })
    )
  );
  define("deleteTask", (taskId) => {
    tasks.require(taskId);
    tasks.remove(taskId);
    attachments.drop((attachment) => attachment.entityId === taskId);
  });
  define("reorderTasks", (placements = []) => {
    placements.forEach(({ taskId, columnId, position, status, completedAt }) => {
      if (!tasks.find(taskId)) return;
      tasks.update(taskId, (task) =>
        withCompletion({ ...task, columnId, position, status, completedAt })
      );
    });
  });
  define("setAssignee", (taskId, userId) => {
    tasks.update(taskId, (task) => ({ ...task, assigneeId: userId || null }));
  });

  /* ------------------------------------------------------------ projects */

  define("listProjects", (userId) =>
    projects.list().map((project) => {
      const membership = data.members.find(
        (member) => member.projectId === project.id && member.userId === userId
      );
      return {
        ...project,
        viewerRole:
          project.ownerId === userId
            ? "owner"
            : membership?.role || project.viewerRole || null,
      };
    })
  );
  define("createProject", (values = {}) => {
    const project = projects.insert(makeProject(values));
    data.columns.push(...defaultColumnsFor(project.id));
    data.members.push(memberRow(project.id, project.ownerId, "owner"));
    return project;
  });
  define("updateProject", (projectId, patch = {}) =>
    projects.update(projectId, (project) => ({
      ...project,
      ...patch,
      updatedAt: nowIso(),
    }))
  );
  define("deleteProject", (projectId) => {
    projects.remove(projectId);
    columns.drop((column) => column.projectId === projectId);
    members.drop((member) => member.projectId === projectId);
    tasks.drop((task) => task.projectId === projectId);
  });
  define("listAllColumns", () => columns.list());
  define("listColumns", listBy(columns, "projectId"));
  define("createDefaultColumns", (projectId) => {
    const existing = columns.list((column) => column.projectId === projectId);
    if (existing.length) return existing;
    return defaultColumnsFor(projectId).map((column) => columns.insert(column));
  });
  define("listAllMembers", () => members.list());
  define("listMembers", listBy(members, "projectId"));
  define("listProfiles", (userIds = []) =>
    [...new Set(userIds.filter(Boolean))].map(profileFor).filter(Boolean).map(copy)
  );
  define("listProjectInvitations", listBy(invitations, "projectId"));
  define("listMyInvitations", (email) =>
    invitations.list(
      (invitation) =>
        invitation.status === "pending" &&
        lower(invitation.email) === lower(email)
    )
  );
  define("sendInvitation", (projectId, invitation = {}) => ({
    success: true,
    invitation: invitations.insert({
      id: nextId("invitation"),
      projectId,
      email: lower(invitation.email),
      role: invitation.role,
      inviterId: data.user?.id || "user-1",
      status: "pending",
      expiresAt: null,
      acceptedBy: null,
      acceptedAt: null,
      createdAt: nowIso(),
      project: null,
    }),
  }));
  define("respondToInvitation", (invitationId, status) => {
    const invitation = invitations.find(invitationId);
    if (!invitation || invitation.status !== "pending") {
      throw new Error("This invitation is no longer available.");
    }

    const userId = data.user?.id || "user-1";
    const accepted = status === "accepted";
    invitations.remove(invitationId);

    if (accepted) {
      // The database trigger writes the membership row; the project becomes
      // visible to the new member at the same moment.
      data.members.push(memberRow(invitation.projectId, userId, invitation.role));
      if (!projects.find(invitation.projectId) && invitation.project) {
        data.projects.push({ ...invitation.project, viewerRole: invitation.role });
      }
    }
    return {
      ...invitation,
      status,
      acceptedBy: accepted ? userId : null,
      acceptedAt: accepted ? nowIso() : null,
    };
  });
  define("cancelInvitation", (projectId, invitationId) => {
    invitations.remove(invitationId);
  });
  define("updateMemberRole", (projectId, userId, role) =>
    members.replace(
      (member) => member.projectId === projectId && member.userId === userId,
      (member) => ({ ...member, role })
    )
  );
  define("removeMember", (projectId, userId) => {
    members.drop(
      (member) => member.projectId === projectId && member.userId === userId
    );
  });

  /* ------------------------------------------------------- collaboration */

  define("listComments", listBy(comments, "taskId"));
  define("createComment", (taskId, content) =>
    comments.insert({
      id: nextId("comment"),
      taskId,
      userId: data.user?.id || "user-1",
      content,
      editedAt: null,
      createdAt: nowIso(),
    })
  );
  define("updateComment", (commentId, content) =>
    comments.update(commentId, (comment) => ({
      ...comment,
      content,
      editedAt: nowIso(),
    }))
  );
  define("deleteComment", (commentId) => {
    comments.remove(commentId);
  });
  define("listProjectActivity", (projectId, limit = 50) =>
    activity.list((event) => event.projectId === projectId).slice(0, limit)
  );
  define("listTaskActivity", (taskId, limit = 30) =>
    activity.list((event) => event.taskId === taskId).slice(0, limit)
  );
  defineChannel("subscribeToComments", (taskId) => `comments:${taskId}`);
  defineChannel(
    "subscribeToProjectActivity",
    (projectId) => `activity:project:${projectId}`
  );
  defineChannel("subscribeToTaskActivity", (taskId) => `activity:task:${taskId}`);

  define("listNotifications", (limit = 100) => notifications.list().slice(0, limit));
  define("markNotificationRead", (notificationId) =>
    notifications.update(notificationId, (notification) => ({
      ...notification,
      readAt: notification.readAt || nowIso(),
    }))
  );
  define("markAllNotificationsRead", () => {
    const readAt = nowIso();
    data.notifications = data.notifications.map((notification) =>
      notification.readAt ? notification : { ...notification, readAt }
    );
  });
  define("deleteNotification", (notificationId) => {
    notifications.require(notificationId);
    notifications.remove(notificationId);
  });
  defineChannel("subscribeToNotifications", () => "notifications");

  /* --------------------------------------------------------- attachments */

  const matchesEntity = (attachment, context) =>
    attachment.projectId === context.projectId &&
    attachment.entityType === context.entityType &&
    attachment.entityId === context.entityId;

  define("listAttachments", (context = {}) =>
    attachments.list((attachment) => matchesEntity(attachment, context))
  );
  define("listTaskAttachmentCounts", (projectId) =>
    attachments
      .list(
        (attachment) =>
          attachment.projectId === projectId && attachment.entityType === "task"
      )
      .reduce((counts, attachment) => {
        counts[attachment.entityId] = (counts[attachment.entityId] || 0) + 1;
        return counts;
      }, {})
  );
  define("uploadAttachment", ({ file, userId, uploaderName, ...context }) =>
    attachments.insert({
      id: nextId("attachment"),
      ...context,
      storagePath: `${context.projectId}/${file?.name || "file"}`,
      fileName: file?.name || "file",
      contentType: file?.type || "application/octet-stream",
      sizeBytes: file?.size || 0,
      uploadedBy: userId,
      uploaderName: uploaderName || "TaskFlow user",
      uploaderAvatarUrl: "",
      createdAt: nowIso(),
    })
  );
  define("openAttachment", (attachment) => `blob:${attachment?.storagePath}`);
  define("removeAttachment", (attachment) => {
    attachments.remove(attachment?.id);
  });
  define("removeAllAttachments", (context = {}) => {
    const wholeProject =
      context.entityType === "project" && context.entityId === context.projectId;
    attachments.drop((attachment) =>
      wholeProject
        ? attachment.projectId === context.projectId
        : matchesEntity(attachment, context)
    );
  });

  /* ------------------------------------------------------------ settings */

  define("getSettings", (user) => {
    if (!user?.uid) throw new Error("A signed-in user is required for settings.");
    return normalizeSettings(data.settings || {}, user);
  });
  define("saveSettings", (user, settings) => {
    if (!user?.uid) throw new Error("A signed-in user is required for settings.");
    const normalized = normalizeSettings(settings, user);
    data.settings = normalized;
    if (data.user) {
      data.user = { ...data.user, displayName: normalized.profile.displayName };
    }
    return { settings: normalized, profileUpdated: true };
  });

  /* ------------------------------------------------------------ calendar */

  define("getGoogleConnection", () => data.googleConnection);
  define("startGoogleOAuth", () => "https://accounts.google.com/o/oauth2/v2/auth");
  define("syncGoogleCalendar", () => ({ events: data.googleEvents }));
  define("disconnectGoogleCalendar", () => {
    data.googleConnection = null;
    data.googleEvents = [];
    return { success: true };
  });

  /* -------------------------------------------------------- test control */

  api.data = data;
  api.calls = calls;

  /** The next call of `name` rejects with `error`. */
  api.failNext = (name, error) => {
    const queued = failures.get(name) || [];
    queued.push(error || new Error(`${name} failed.`));
    failures.set(name, queued);
    return api;
  };

  /** Every call of `name`, in order, with its arguments. */
  api.callsOf = (name) =>
    calls.filter(([called]) => called === name).map(([, ...args]) => args);

  api.callCount = (name) => api.callsOf(name).length;

  /** Fires the callbacks a realtime subscription registered on `channel`. */
  api.emit = (channel = "notifications", payload = {}) => {
    (channels.get(channel) || new Set()).forEach((listener) => listener(payload));
    return api;
  };

  return api;
};
