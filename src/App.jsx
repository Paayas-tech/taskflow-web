import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AppShell from "./shell/AppShell";
import Sidebar from "./shell/Sidebar";
import SearchDialog from "./shell/SearchDialog";
import { readProjectTab, writeProjectTab } from "./shell/projectTabPreference";
import useNotifications from "./inbox/useNotifications";
import HomePage from "./pages/HomePage";
import MyTasksPage from "./pages/MyTasksPage";
import CalendarPage from "./pages/CalendarPage";
import InboxPage from "./pages/InboxPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectWorkspacePage from "./pages/ProjectWorkspacePage";
import ArchivedTasksPage from "./pages/ArchivedTasksPage";
import SettingsPage from "./SettingsPage";
import ConfigurationErrorScreen from "./auth/ConfigurationErrorScreen";
import Login from "./auth/Login";
import Onboarding from "./auth/Onboarding";
import Recover from "./auth/Recover";
import ProfileCompletionPrompt from "./collaboration/ProfileCompletionPrompt";
import ConnectedTaskDetailPanel from "./tasks/ConnectedTaskDetailPanel";
import TaskComposerDialog from "./tasks/TaskComposerDialog";
import { Icon, IconButton } from "./ui";
import {
  completeOnboarding,
  deleteAccount,
  onAuthStateChange,
  signOut,
} from "./application/authService";
import { createSignOutController } from "./application/signOutController";
import { googleCalendarIntegrationService } from "./application/googleCalendarIntegrationService";
import { attachmentService } from "./application/attachmentService";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  archiveTask,
  unarchiveTask,
} from "./application/taskService";
import {
  createProject,
  createProjectTask,
  acceptProjectInvitation,
  archiveProjectTask,
  declineProjectInvitation,
  deleteProject,
  deleteProjectTask,
  getAssignedProjectTasks,
  getProjects,
  getUserInvitations,
  setTaskAssignee,
  updateProject,
  updateProjectTask,
} from "./application/projectService";
import { createReminderScheduler } from "./services/reminderService";
import { getSettings, saveSettings } from "./application/settingsService";
import {
  defaultViewPath,
  effectiveMyDayDate,
  normalizeSettings,
  resolveThemeMode,
  weekStartIndex,
} from "./domain/settingsDomain";
import {
  isCurrentAuthRequest,
  shouldWaitForOnboardingSettings,
} from "./domain/authDomain";
import {
  filterActiveTasks,
  filterArchivedTasks,
} from "./domain/archivedTasksDomain";
import { isArchived, isTaskComplete } from "./domain/taskDomain";
import { isSupabaseConfigured } from "./infrastructure/supabase/client";
import {
  normalizePath,
  pageTitle,
  projectIdFromPath,
  projectPath,
  projectTabFromPath,
  routeViewFromPath,
} from "./app/appRoutes";

const rememberedViewPaths = ["/", "/tasks", "/calendar", "/inbox", "/projects"];

const emptyTaskValues = {
  title: "",
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
  listId: null,
  projectId: null,
};

const updateSettingsLastViewed = (settings, path) => ({
  ...settings,
  navigation: {
    ...settings.navigation,
    lastViewedPath: path,
  },
});

const profilePromptDismissalKey = (userId) =>
  `taskflow.profile-prompt-dismissed.${userId}`;

const wasProfilePromptDismissed = (userId) => {
  if (!userId) return false;
  try {
    return window.sessionStorage?.getItem(profilePromptDismissalKey(userId)) === "true";
  } catch {
    return false;
  }
};

// Pages sometimes wire `onNewTask` straight to a click handler; never treat a
// DOM event as composer values.
const composerInitialValues = (value) =>
  value && typeof value === "object" && typeof value.preventDefault !== "function"
    ? value
    : {};

const isTypingTarget = (target) =>
  Boolean(target) &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.isContentEditable === true);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configurationUnavailable, setConfigurationUnavailable] = useState(
    !isSupabaseConfigured
  );
  const [signOutState, setSignOutState] = useState({ pending: false, error: "" });
  const [deleteAccountState, setDeleteAccountState] = useState({
    pending: false,
    error: "",
  });
  const [passwordRecoverySession, setPasswordRecoverySession] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState("signin");
  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(window.location.pathname)
  );
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectCreateRequest, setProjectCreateRequest] = useState(0);
  const [projectTaskRefreshToken, setProjectTaskRefreshToken] = useState(0);
  const [projectItemOpenRequest, setProjectItemOpenRequest] = useState(null);
  const [assignedProjectTasks, setAssignedProjectTasks] = useState([]);
  const [assignedProjectTasksLoading, setAssignedProjectTasksLoading] = useState(false);
  const [assignedProjectTasksError, setAssignedProjectTasksError] = useState("");
  const [projectInvitations, setProjectInvitations] = useState([]);
  const [projectInvitationsLoading, setProjectInvitationsLoading] = useState(false);
  const [projectInvitationsError, setProjectInvitationsError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage?.getItem("taskflow:sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [composer, setComposer] = useState({
    open: false,
    initialValues: {},
    workType: "task",
  });
  const [settings, setSettings] = useState(() => normalizeSettings());
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState("");
  const [settingsLoadedUserId, setSettingsLoadedUserId] = useState("");
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [profileSettingsRequest, setProfileSettingsRequest] = useState(0);
  const [dismissedProfilePromptUserId, setDismissedProfilePromptUserId] = useState("");
  const [reminderNotice, setReminderNotice] = useState(null);
  const [quickTaskPendingIds, setQuickTaskPendingIds] = useState(() => new Set());
  const [projectTaskPendingIds, setProjectTaskPendingIds] = useState(() => new Set());

  const tasksRef = useRef([]);
  const reminderSchedulerRef = useRef(null);
  const settingsRef = useRef(settings);
  const notifiedReminderIdsRef = useRef(new Set());
  const quickTaskMutationsRef = useRef(new Map());
  const defaultRouteAppliedRef = useRef(false);
  const authenticatedUserIdRef = useRef(null);
  const signOutControllerRef = useRef(null);

  if (!signOutControllerRef.current) {
    signOutControllerRef.current = createSignOutController({
      performSignOut: signOut,
      onStateChange: setSignOutState,
    });
  }

  const selectedProjectId = projectIdFromPath(currentPath);
  const currentView = routeViewFromPath(currentPath);
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) || null;
  const projectTab = projectTabFromPath(currentPath);

  const handleSignOut = useCallback(() => {
    setAuthEntryMode("signin");
    void signOutControllerRef.current.run();
  }, []);

  const handleRestartSignup = useCallback(async () => {
    setAuthEntryMode("signup");
    const result = await signOutControllerRef.current.run();
    if (!result.ok) {
      throw new Error(result.error || "We couldn't restart signup. Please try again.");
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteAccountState.pending) return;
    setDeleteAccountState({ pending: true, error: "" });
    try {
      await deleteAccount();
      setAuthEntryMode("signin");
      setUser(null);
      window.history.replaceState({}, "", "/");
      setCurrentPath("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      setDeleteAccountState({
        pending: false,
        error: "We couldn't delete your account. Please try again.",
      });
    }
  }, [deleteAccountState.pending]);

  const handleSignInSuccess = useCallback(() => {
    setAuthEntryMode("signin");
    defaultRouteAppliedRef.current = true;
    window.history.replaceState({}, "", "/");
    setCurrentPath("/");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleRecoveryComplete = useCallback(() => {
    setPasswordRecoverySession(false);
    defaultRouteAppliedRef.current = true;
    window.history.replaceState({}, "", "/");
    setCurrentPath("/");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleOnboardingComplete = useCallback(
    async ({ displayName, purpose }) => {
      if (!user) return;

      setOnboardingSaving(true);
      try {
        const nextSettings = normalizeSettings(
          {
            ...settingsRef.current,
            profile: { ...settingsRef.current.profile, displayName },
            data: { ...settingsRef.current.data, onboardingPurpose: purpose },
          },
          user
        );
        const saved = await saveSettings(user, nextSettings);
        await completeOnboarding();
        settingsRef.current = saved.settings;
        setSettings(saved.settings);
        setUser((currentUser) =>
          currentUser ? { ...currentUser, onboardingRequired: false } : currentUser
        );

        const destination = defaultViewPath(
          saved.settings.navigation.defaultView,
          saved.settings.navigation.lastViewedPath
        );
        window.history.replaceState({}, "", destination);
        setCurrentPath(destination);
      } finally {
        setOnboardingSaving(false);
      }
    },
    [user]
  );

  const syncQuickTaskPendingIds = useCallback(() => {
    setQuickTaskPendingIds(
      new Set(
        [...quickTaskMutationsRef.current.entries()]
          .filter(([, mutation]) => mutation.pendingCount > 0)
          .map(([taskId]) => taskId)
      )
    );
  }, []);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.uid;

    setTasksLoading(true);
    setTasksError("");

    try {
      const userTasks = await getTasks(requestUserId);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      const tasksWithPendingChanges = userTasks.map((task) => {
        const pendingMutation = quickTaskMutationsRef.current.get(task.id);

        return pendingMutation
          ? { ...task, ...pendingMutation.optimisticPatch }
          : task;
      });

      tasksRef.current = tasksWithPendingChanges;
      setTasks(tasksWithPendingChanges);
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading tasks:", error);
      tasksRef.current = [];
      setTasks([]);
      setTasksError(
        "We couldn't load your tasks. Check your connection and try again."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setTasksLoading(false);
      }
    }
  }, [user]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.uid;

    setProjectsLoading(true);
    setProjectsError("");

    try {
      const userProjects = await getProjects(requestUserId);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      setProjects(userProjects);
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading projects:", error);
      setProjects([]);
      setProjectsError(
        "We couldn't load your projects. Check your connection and try again."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setProjectsLoading(false);
      }
    }
  }, [user]);

  const loadAssignedProjectTasks = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.uid;

    setAssignedProjectTasksLoading(true);
    setAssignedProjectTasksError("");

    try {
      const assignments = await getAssignedProjectTasks(requestUserId);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      setAssignedProjectTasks(assignments);
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading assigned project tasks:", error);
      setAssignedProjectTasks([]);
      setAssignedProjectTasksError(
        "We couldn't load your assigned project tasks. Try again."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setAssignedProjectTasksLoading(false);
      }
    }
  }, [user]);

  const loadProjectInvitations = useCallback(async () => {
    if (!user?.email) return;
    const requestUserId = user.uid;
    setProjectInvitationsLoading(true);
    setProjectInvitationsError("");
    try {
      const invitations = await getUserInvitations(requestUserId, user.email);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      setProjectInvitations(invitations);
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading project invitations:", error);
      setProjectInvitations([]);
      setProjectInvitationsError(
        "We couldn't load your project invitations. Try again."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setProjectInvitationsLoading(false);
      }
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.uid;

    setSettingsLoading(true);
    setSettingsError("");
    setSettingsSaveMessage("");

    try {
      const userSettings = await getSettings(user);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      settingsRef.current = userSettings;
      setSettings(userSettings);

      if (!defaultRouteAppliedRef.current) {
        defaultRouteAppliedRef.current = true;
        if (normalizePath(window.location.pathname) === "/") {
          const startupPath = defaultViewPath(
            userSettings.navigation.defaultView,
            userSettings.navigation.lastViewedPath
          );
          if (startupPath !== "/") {
            window.history.replaceState({}, "", startupPath);
            setCurrentPath(startupPath);
          }
        }
      }
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading settings:", error);
      const fallback = normalizeSettings({}, user);
      settingsRef.current = fallback;
      setSettings(fallback);
      setSettingsError(
        "We couldn't load your saved settings. Safe defaults are active."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setSettingsLoading(false);
        setSettingsLoadedUserId(requestUserId);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConfigurationUnavailable(true);
      setLoading(false);
      return undefined;
    }

    let unsubscribe;
    try {
      unsubscribe = onAuthStateChange((event, currentUser) => {
        const nextUserId = currentUser?.uid || null;
        const userChanged = nextUserId !== authenticatedUserIdRef.current;

        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoverySession(true);
          window.history.replaceState({}, "", "/recover");
          setCurrentPath("/recover");
        } else if (!currentUser) {
          setPasswordRecoverySession(false);
        }

        if (userChanged) {
          signOutControllerRef.current.reset();
          defaultRouteAppliedRef.current = false;
          tasksRef.current = [];
          quickTaskMutationsRef.current.clear();
          notifiedReminderIdsRef.current.clear();
          setTasks([]);
          setTasksError("");
          setTasksLoading(false);
          setQuickTaskPendingIds(new Set());
          setProjectTaskPendingIds(new Set());
          setProjects([]);
          setProjectsError("");
          setProjectsLoading(false);
          setAssignedProjectTasks([]);
          setAssignedProjectTasksError("");
          setAssignedProjectTasksLoading(false);
          setProjectInvitations([]);
          setProjectInvitationsError("");
          setProjectInvitationsLoading(false);
          setSelectedTaskId(null);
          setComposer({ open: false, initialValues: {}, workType: "task" });
          setSearchOpen(false);
          setReminderNotice(null);
          setDeleteAccountState({ pending: false, error: "" });

          const fallbackSettings = normalizeSettings({}, currentUser || undefined);
          settingsRef.current = fallbackSettings;
          setSettings(fallbackSettings);
          setSettingsError("");
          setSettingsSaveMessage("");
          setSettingsLoading(false);
          setSettingsSaving(false);
          setSettingsLoadedUserId("");
        }
        authenticatedUserIdRef.current = nextUserId;
        setUser((previousUser) => {
          if (
            previousUser?.uid === nextUserId &&
            previousUser?.email === currentUser?.email &&
            previousUser?.displayName === currentUser?.displayName
          ) {
            return previousUser;
          }
          return currentUser;
        });
        setLoading(false);
      });
    } catch {
      setConfigurationUnavailable(true);
      setLoading(false);
      return undefined;
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncPathFromBrowser = () => {
      const nextPath = normalizePath(window.location.pathname);

      if (window.location.pathname !== nextPath) {
        window.history.replaceState({}, "", nextPath);
      }

      setCurrentPath(nextPath);
    };

    syncPathFromBrowser();
    window.addEventListener("popstate", syncPathFromBrowser);

    return () => window.removeEventListener("popstate", syncPathFromBrowser);
  }, []);

  useEffect(() => {
    if (user) {
      loadTasks();
      loadProjects();
      loadAssignedProjectTasks();
      loadProjectInvitations();
      loadSettings();
    }
  }, [
    user,
    loadTasks,
    loadProjects,
    loadAssignedProjectTasks,
    loadProjectInvitations,
    loadSettings,
  ]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = resolveThemeMode(settings.theme.mode, mediaQuery.matches);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();
    if (settings.theme.mode !== "system") return undefined;

    mediaQuery.addEventListener?.("change", applyTheme);
    return () => mediaQuery.removeEventListener?.("change", applyTheme);
  }, [settings.theme.mode]);

  useEffect(() => {
    document.documentElement.lang = settings.language.code;
  }, [settings.language.code]);

  useEffect(() => {
    document.title = `${pageTitle(currentView, selectedProject)} · TaskFlow`;
  }, [currentView, selectedProject]);

  useEffect(() => {
    if (!user || currentPath !== "/calendar") return undefined;
    let active = true;
    void (async () => {
      try {
        const connection = await googleCalendarIntegrationService.getConnection();
        if (!connection) {
          if (active) setGoogleCalendarEvents([]);
          return;
        }
        const result = await googleCalendarIntegrationService.sync();
        if (active) {
          setGoogleCalendarEvents(Array.isArray(result.events) ? result.events : []);
        }
      } catch (error) {
        console.warn("Google Calendar events could not be refreshed", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentPath, user]);

  useEffect(() => {
    tasksRef.current = tasks;
    reminderSchedulerRef.current?.check();
  }, [tasks]);

  useEffect(() => {
    if (!user) {
      setReminderNotice(null);
      return undefined;
    }

    // Never let a new authenticated session inspect reminder data retained in
    // memory from the previous user while its own task load is still pending.
    tasksRef.current = [];
    notifiedReminderIdsRef.current.clear();
    settingsRef.current = normalizeSettings({}, user);

    const scheduler = createReminderScheduler({
      getTasks: () => tasksRef.current,
      notifiedIds: notifiedReminderIdsRef.current,
      onInAppReminder: (task) => setReminderNotice(task),
      getPreferences: () => settingsRef.current.reminder,
    });
    reminderSchedulerRef.current = scheduler;
    scheduler.start();

    return () => {
      reminderSchedulerRef.current = null;
      scheduler.stop();
    };
  }, [user]);

  useEffect(() => {
    const openSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const quickUpdatePersonalTask = useCallback(
    (taskId, data) => {
      if (!user) {
        return Promise.reject(new Error("You must be signed in to update a task."));
      }

      const currentTask = tasksRef.current.find((task) => task.id === taskId);

      if (!currentTask) {
        return Promise.reject(new Error("The selected task is unavailable."));
      }

      const existingMutation = quickTaskMutationsRef.current.get(taskId);
      const patchAlreadyApplied = Object.entries(data).every(
        ([field, value]) => currentTask[field] === value
      );

      if (patchAlreadyApplied) {
        return existingMutation?.chain || Promise.resolve();
      }

      const mutation = existingMutation || {
        chain: Promise.resolve(),
        confirmedTask: currentTask,
        optimisticPatch: {},
        pendingCount: 0,
        version: 0,
      };
      const mutationVersion = mutation.version + 1;

      mutation.version = mutationVersion;
      mutation.pendingCount += 1;
      mutation.optimisticPatch = {
        ...mutation.optimisticPatch,
        ...data,
      };
      quickTaskMutationsRef.current.set(taskId, mutation);

      const optimisticTasks = tasksRef.current.map((task) =>
        task.id === taskId ? { ...task, ...data } : task
      );
      tasksRef.current = optimisticTasks;
      setTasks(optimisticTasks);
      syncQuickTaskPendingIds();

      const previousOperation = mutation.chain;
      const operation = previousOperation
        .catch(() => undefined)
        .then(async () => {
          await updateTask(user.uid, taskId, data);
          mutation.confirmedTask = {
            ...mutation.confirmedTask,
            ...data,
          };
        })
        .catch((error) => {
          if (mutation.version !== mutationVersion) {
            console.error("A superseded task update could not be saved:", error);
            return;
          }

          const rollbackFields = Object.keys(mutation.optimisticPatch);
          const rolledBackTasks = tasksRef.current.map((task) => {
            if (task.id !== taskId) return task;

            const rolledBackTask = { ...task };
            rollbackFields.forEach((field) => {
              rolledBackTask[field] = mutation.confirmedTask[field];
            });
            return rolledBackTask;
          });

          tasksRef.current = rolledBackTasks;
          setTasks(rolledBackTasks);
          throw error;
        })
        .finally(() => {
          mutation.pendingCount -= 1;

          if (mutation.pendingCount === 0) {
            quickTaskMutationsRef.current.delete(taskId);
          }

          syncQuickTaskPendingIds();
        });

      mutation.chain = operation;
      return operation;
    },
    [syncQuickTaskPendingIds, user]
  );

  const quickUpdateProjectTask = useCallback(
    async (task, patch) => {
      if (!user) throw new Error("You must be signed in to update a task.");

      setProjectTaskPendingIds((current) => new Set(current).add(task.id));
      setAssignedProjectTasks((current) =>
        current.map((candidate) =>
          candidate.id === task.id ? { ...candidate, ...patch } : candidate
        )
      );

      try {
        await updateProjectTask(user.uid, task.projectId, task.id, patch);
      } catch (error) {
        console.error("Error updating a project task:", error);
        await loadAssignedProjectTasks();
        throw error;
      } finally {
        setProjectTaskPendingIds((current) => {
          const next = new Set(current);
          next.delete(task.id);
          return next;
        });
      }
    },
    [loadAssignedProjectTasks, user]
  );

  const pendingTaskIds = useMemo(
    () => new Set([...quickTaskPendingIds, ...projectTaskPendingIds]),
    [projectTaskPendingIds, quickTaskPendingIds]
  );

  const taskActions = useMemo(() => {
    const requireUser = () => {
      if (!user) throw new Error("You must be signed in to change a task.");
      return user.uid;
    };

    const update = async (task, patch) => {
      const uid = requireUser();
      if (task.projectId) {
        await updateProjectTask(uid, task.projectId, task.id, patch);
        await loadAssignedProjectTasks();
        setProjectTaskRefreshToken((token) => token + 1);
        return;
      }
      await updateTask(uid, task.id, patch);
      await loadTasks();
    };

    const quickUpdate = (task, patch) => {
      if (task.projectId) return quickUpdateProjectTask(task, patch);
      return quickUpdatePersonalTask(task.id, patch);
    };

    return {
      pendingIds: pendingTaskIds,
      update,
      quickUpdate,
      toggleComplete(task) {
        const completing = !isTaskComplete(task);
        return quickUpdate(task, {
          completed: completing,
          status: completing ? "completed" : "todo",
          completedAt: completing ? new Date().toISOString() : null,
        });
      },
      async archive(task) {
        const uid = requireUser();
        if (task.projectId) {
          await archiveProjectTask(uid, task.projectId, task.id);
          await loadAssignedProjectTasks();
          setProjectTaskRefreshToken((token) => token + 1);
          return;
        }
        await archiveTask(uid, task.id);
        await loadTasks();
      },
      async restore(task) {
        const uid = requireUser();
        if (task.projectId) {
          await updateProjectTask(uid, task.projectId, task.id, { archivedAt: null });
          await loadAssignedProjectTasks();
          setProjectTaskRefreshToken((token) => token + 1);
          return;
        }
        await unarchiveTask(uid, task.id);
        await loadTasks();
      },
      async remove(task) {
        const uid = requireUser();
        if (task.projectId) {
          await deleteProjectTask(uid, task.projectId, task.id);
          await loadAssignedProjectTasks();
          setProjectTaskRefreshToken((token) => token + 1);
          return;
        }
        await deleteTask(uid, task.id);
        await loadTasks();
      },
      async setAssignee(task, assigneeId) {
        const uid = requireUser();
        if (!task.projectId) return;
        await setTaskAssignee(uid, task.projectId, task.id, assigneeId || null);
        await loadAssignedProjectTasks();
        setProjectTaskRefreshToken((token) => token + 1);
      },
      async createPersonal(values = {}) {
        const uid = requireUser();
        const taskData = {
          ...emptyTaskValues,
          ...values,
          projectId: null,
        };
        taskData.completed = values.completed ?? taskData.status === "completed";
        const created = await createTask(uid, taskData);
        await loadTasks();
        return created;
      },
      async createInProject(projectId, values = {}) {
        const uid = requireUser();
        const { assigneeId, ...rest } = values;
        const taskData = {
          ...emptyTaskValues,
          ...rest,
          projectId,
        };
        taskData.completed = values.completed ?? taskData.status === "completed";
        const created = await createProjectTask(uid, projectId, taskData);
        if (assigneeId && created?.id) {
          await setTaskAssignee(uid, projectId, created.id, assigneeId);
        }
        await loadAssignedProjectTasks();
        setProjectTaskRefreshToken((token) => token + 1);
        return created;
      },
    };
  }, [
    loadAssignedProjectTasks,
    loadTasks,
    pendingTaskIds,
    quickUpdatePersonalTask,
    quickUpdateProjectTask,
    user,
  ]);

  const myTasks = useMemo(() => {
    const merged = [];
    const seen = new Set();

    for (const task of filterActiveTasks(tasks)) {
      merged.push(task);
      seen.add(task.id);
    }
    for (const task of assignedProjectTasks) {
      if (task.workType === "story" || isArchived(task) || seen.has(task.id)) continue;
      merged.push(task);
      seen.add(task.id);
    }
    return merged;
  }, [assignedProjectTasks, tasks]);

  const notifications = useNotifications(user?.uid || "");

  const selectedTask = selectedTaskId
    ? myTasks.find((task) => task.id === selectedTaskId) || null
    : null;

  useEffect(() => {
    if (selectedTaskId && !selectedTask) setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId]);

  const handleCreateProject = useCallback(
    async (projectData) => {
      if (!user) {
        throw new Error("You must be signed in to create a project.");
      }

      const projectReference = await createProject(user.uid, {
        ...projectData,
        position: projects.length,
      });
      await loadProjects();
      return projectReference.id;
    },
    [user, projects.length, loadProjects]
  );

  const handleRestoreProject = useCallback(
    async (projectId) => {
      if (!user) throw new Error("You must be signed in to restore a project.");
      await updateProject(user.uid, projectId, { status: "active" });
      await Promise.all([loadProjects(), loadAssignedProjectTasks()]);
    },
    [user, loadAssignedProjectTasks, loadProjects]
  );

  const handleUpdateProject = useCallback(
    async (projectId, data) => {
      if (!user) throw new Error("You must be signed in to update a project.");
      await updateProject(user.uid, projectId, data);
      await Promise.all([loadProjects(), loadAssignedProjectTasks()]);
    },
    [user, loadAssignedProjectTasks, loadProjects]
  );

  const handleDeleteProject = useCallback(
    async (projectId) => {
      if (!user) throw new Error("You must be signed in to delete a project.");
      await attachmentService.removeAll({
        projectId,
        entityType: "project",
        entityId: projectId,
      });
      await deleteProject(user.uid, projectId);
      await Promise.all([loadProjects(), loadAssignedProjectTasks()]);
    },
    [user, loadAssignedProjectTasks, loadProjects]
  );

  const handleAcceptProjectInvitation = useCallback(
    async (invitationId) => {
      if (!user) throw new Error("You must be signed in to accept an invitation.");
      await acceptProjectInvitation(user.uid, invitationId);
      await Promise.all([
        loadProjects(),
        loadAssignedProjectTasks(),
        loadProjectInvitations(),
      ]);
    },
    [loadAssignedProjectTasks, loadProjectInvitations, loadProjects, user]
  );

  const handleDeclineProjectInvitation = useCallback(
    async (invitationId) => {
      if (!user) throw new Error("You must be signed in to decline an invitation.");
      await declineProjectInvitation(user.uid, invitationId);
      await loadProjectInvitations();
    },
    [loadProjectInvitations, user]
  );

  const handleSettingsChange = (nextSettings) => {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setSettingsSaveMessage("");
    setSettingsError("");
  };

  const handleSaveSettings = async (nextSettings) => {
    if (!user) throw new Error("You must be signed in to save settings.");

    setSettingsSaving(true);
    setSettingsError("");
    setSettingsSaveMessage("");

    try {
      const result = await saveSettings(user, nextSettings);
      settingsRef.current = result.settings;
      setSettings(result.settings);
      setSettingsSaveMessage(
        result.profileUpdated ? "Changes saved." : "Saved locally."
      );
      return result.settings;
    } catch (error) {
      console.error("Error saving settings:", error);
      setSettingsError(
        error?.message || "We couldn't save your settings. Please try again."
      );
      throw error;
    } finally {
      setSettingsSaving(false);
    }
  };

  const navigate = (path) => {
    setMobileNavOpen(false);
    if (path === currentPath) return;

    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "auto" });

    if (path === "/" && user) {
      void loadAssignedProjectTasks();
    }

    if (!user || !rememberedViewPaths.includes(path)) return;

    const nextSettings = updateSettingsLastViewed(settingsRef.current, path);
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    void saveSettings(user, nextSettings).catch((error) => {
      console.error("Error remembering the last viewed page:", error);
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage?.setItem("taskflow:sidebar-collapsed", String(next));
      } catch {
        // The preference still applies for the current session.
      }
      return next;
    });
  };

  const openComposer = (requestedValues) => {
    const initialValues = composerInitialValues(requestedValues);
    setComposer({
      open: true,
      initialValues,
      workType: initialValues.workType || "task",
    });
  };

  const closeComposer = () =>
    setComposer({ open: false, initialValues: {}, workType: "task" });

  const openProjectCreate = () => {
    setProjectCreateRequest((request) => request + 1);
    navigate("/projects");
  };

  const openProject = (projectId) =>
    navigate(projectPath(projectId, readProjectTab(projectId)));

  /**
   * "Go to project" from a task shown outside its project (My Tasks, Home,
   * Calendar, Archived, the detail panel): close the global panel, ask the
   * workspace to open the same task, then navigate to the project.
   */
  const openTaskInProject = (task) => {
    if (!task?.projectId) return;
    setSelectedTaskId(null);
    setProjectItemOpenRequest({
      projectId: task.projectId,
      itemId: task.id,
      request: Date.now(),
    });
    openProject(task.projectId);
  };

  const openProfileSettings = () => {
    setProfileSettingsRequest((request) => request + 1);
    navigate("/settings");
  };

  const handleProjectTabChange = (tab) => {
    if (!selectedProjectId) return;
    writeProjectTab(selectedProjectId, tab);
    navigate(projectPath(selectedProjectId, tab));
  };

  const handleComposerSubmit = (values) =>
    values.projectId
      ? taskActions.createInProject(values.projectId, values)
      : taskActions.createPersonal(values);

  const searchItems = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const items = projects.map((project) => ({
      id: `project:${project.id}`,
      type: "project",
      title: project.name,
      subtitle: project.description || "Project",
      project,
    }));

    for (const task of myTasks) {
      items.push({
        id: `task:${task.id}`,
        type: "task",
        title: task.title,
        subtitle: task.projectId
          ? projectsById.get(task.projectId)?.name || task.projectName || "Project task"
          : "Personal task",
        task,
      });
    }

    for (const task of assignedProjectTasks) {
      if (task.workType !== "story" || isArchived(task)) continue;
      items.push({
        id: `story:${task.id}`,
        type: "story",
        title: task.title,
        subtitle:
          projectsById.get(task.projectId)?.name || task.projectName || "Story",
        task,
      });
    }

    return items;
  }, [assignedProjectTasks, myTasks, projects]);

  const handleSearchSelect = (item) => {
    if (item.type === "project") {
      openProject(item.project.id);
      return;
    }
    const task = item.task;
    if (task.projectId) {
      openTaskInProject(task);
      return;
    }
    setSelectedTaskId(task.id);
  };

  if (configurationUnavailable) {
    return <ConfigurationErrorScreen onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (currentPath === "/recover") {
    return (
      <Recover
        recoverySession={passwordRecoverySession}
        onBack={() => navigate("/")}
        onComplete={handleRecoveryComplete}
      />
    );
  }

  if (!user) {
    return (
      <Login
        initialMode={authEntryMode}
        onSignInSuccess={handleSignInSuccess}
        onRecoverPassword={() => navigate("/recover")}
      />
    );
  }

  if (shouldWaitForOnboardingSettings(user, settingsLoading, settingsLoadedUserId)) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (user.onboardingRequired && !settingsLoading && settingsLoadedUserId === user.uid) {
    return (
      <Onboarding
        displayName={settings.profile.displayName || user.displayName}
        saving={onboardingSaving}
        onComplete={handleOnboardingComplete}
        onStartOver={handleRestartSignup}
      />
    );
  }

  const displayName =
    settings.profile.displayName ||
    user.displayName ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    "there";
  const archivedTasks = filterArchivedTasks(tasks);
  const editableProjects = projects.filter((project) =>
    ["owner", "editor"].includes(project.viewerRole)
  );
  const showProfilePrompt =
    !settingsLoading &&
    settingsLoadedUserId === user.uid &&
    !String(settings.profile.displayName || "").trim() &&
    dismissedProfilePromptUserId !== user.uid &&
    !wasProfilePromptDismissed(user.uid);

  const openTaskDetail = (task) => {
    if (task?.id) setSelectedTaskId(task.id);
  };

  const renderPage = () => {
    if (currentView === "tasks") {
      return (
        <MyTasksPage
          userId={user.uid}
          tasks={myTasks}
          tasksLoading={tasksLoading || assignedProjectTasksLoading}
          tasksError={tasksError || assignedProjectTasksError}
          onRetry={() => {
            void loadTasks();
            void loadAssignedProjectTasks();
          }}
          projects={projects}
          taskActions={taskActions}
          onOpenTask={openTaskDetail}
          onOpenProject={openTaskInProject}
          selectedTaskId={selectedTaskId}
          onNewTask={openComposer}
          formatSettings={settings.time}
          weekStartsOn={weekStartIndex(settings.time.weekStartsOn)}
        />
      );
    }

    if (currentView === "calendar") {
      return (
        <CalendarPage
          userId={user.uid}
          tasks={myTasks}
          externalEvents={googleCalendarEvents}
          tasksLoading={tasksLoading}
          tasksError={tasksError}
          onRetry={loadTasks}
          taskActions={taskActions}
          onOpenTask={openTaskDetail}
          onOpenProject={openTaskInProject}
          selectedTaskId={selectedTaskId}
          onNewTask={openComposer}
          formatSettings={settings.time}
          weekStartsOn={weekStartIndex(settings.time.weekStartsOn)}
          projects={projects}
        />
      );
    }

    if (currentView === "inbox") {
      return (
        <InboxPage
          notifications={notifications.notifications}
          loading={notifications.loading}
          error={notifications.error}
          liveNotice={notifications.liveNotice}
          onMarkRead={notifications.markRead}
          onMarkAllRead={notifications.markAllRead}
          onDismiss={notifications.dismiss}
          onRefresh={notifications.refresh}
          onNavigate={navigate}
          onOpenSettings={() => navigate("/settings")}
        />
      );
    }

    if (currentView === "projects") {
      return (
        <ProjectsPage
          userId={user.uid}
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          onRetry={loadProjects}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onOpenProject={openProject}
          createRequest={projectCreateRequest}
          invitations={projectInvitations}
          invitationsLoading={projectInvitationsLoading}
          invitationsError={projectInvitationsError}
          onRetryInvitations={loadProjectInvitations}
          onAcceptInvitation={handleAcceptProjectInvitation}
          onDeclineInvitation={handleDeclineProjectInvitation}
        />
      );
    }

    if (currentView === "project") {
      return (
        <ProjectWorkspacePage
          key={selectedProjectId}
          userId={user.uid}
          projectId={selectedProjectId}
          project={selectedProject}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          onRetryProjects={loadProjects}
          tab={projectTab}
          onTabChange={handleProjectTabChange}
          openItemRequest={projectItemOpenRequest}
          refreshToken={projectTaskRefreshToken}
          onProjectTasksChanged={loadAssignedProjectTasks}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onBack={() => navigate("/projects")}
          formatSettings={settings.time}
          browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
          defaultReminderMinutes={settings.reminder.defaultTime}
        />
      );
    }

    if (currentView === "settings") {
      return (
        <SettingsPage
          settings={settings}
          loading={settingsLoading}
          error={settingsError}
          saving={settingsSaving}
          saveMessage={settingsSaveMessage}
          onRetry={loadSettings}
          onChange={handleSettingsChange}
          onSave={handleSaveSettings}
          onCommit={handleSaveSettings}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
          deleteAccountPending={deleteAccountState.pending}
          deleteAccountError={deleteAccountState.error}
          signOutPending={signOutState.pending}
          signOutError={signOutState.error}
          onNavigate={navigate}
          profileRequest={profileSettingsRequest}
          onOpenProjectCreate={openProjectCreate}
          onRestoreProject={handleRestoreProject}
          exportData={{
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
            tasks,
            projects,
          }}
          onGoogleEventsChange={setGoogleCalendarEvents}
        />
      );
    }

    if (currentView === "archived") {
      return (
        <ArchivedTasksPage
          tasks={archivedTasks}
          loading={tasksLoading}
          error={tasksError}
          onRetry={loadTasks}
          taskActions={taskActions}
          onOpenTask={openTaskDetail}
          onOpenProject={openTaskInProject}
          onBack={() => navigate("/settings")}
          projects={projects}
          formatSettings={settings.time}
        />
      );
    }

    return (
      <HomePage
        userId={user.uid}
        displayName={displayName}
        now={effectiveMyDayDate(new Date(), settings.myDay)}
        tasks={myTasks}
        tasksLoading={tasksLoading || assignedProjectTasksLoading}
        tasksError={tasksError}
        onRetryTasks={loadTasks}
        projects={projects}
        projectsLoading={projectsLoading}
        projectsError={projectsError}
        onRetryProjects={loadProjects}
        invitations={projectInvitations}
        invitationsLoading={projectInvitationsLoading}
        onAcceptInvitation={handleAcceptProjectInvitation}
        onDeclineInvitation={handleDeclineProjectInvitation}
        notifications={notifications.notifications}
        notificationsLoading={notifications.loading}
        taskActions={taskActions}
        onOpenTask={openTaskDetail}
        onOpenProject={openTaskInProject}
        selectedTaskId={selectedTaskId}
        onNewTask={openComposer}
        onNewProject={openProjectCreate}
        onNavigate={navigate}
        formatSettings={settings.time}
      />
    );
  };

  return (
    <>
      <AppShell
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        sidebar={
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebar}
            currentPath={currentPath}
            currentView={currentView}
            projects={projects}
            selectedProjectId={selectedProjectId}
            unreadCount={notifications.unreadCount}
            invitationCount={projectInvitations.length}
            onNavigate={navigate}
            onNewTask={() => openComposer()}
            onNewProject={openProjectCreate}
            onOpenSearch={() => setSearchOpen(true)}
            user={{ displayName, email: user.email }}
            onOpenProfile={openProfileSettings}
            onOpenSettings={() => navigate("/settings")}
            onSignOut={handleSignOut}
            signOutPending={signOutState.pending}
            signOutError={signOutState.error}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />
        }
      >
        <IconButton
          className="menu-toggle app-menu-toggle"
          label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Icon name="list" />
        </IconButton>
        {showProfilePrompt ? (
          <ProfileCompletionPrompt
            displayName={settings.profile.displayName}
            onOpenProfile={openProfileSettings}
            onDismiss={() => {
              try {
                window.sessionStorage?.setItem(
                  profilePromptDismissalKey(user.uid),
                  "true"
                );
              } catch {
                // Session storage is optional; in-memory dismissal still applies.
              }
              setDismissedProfilePromptUserId(user.uid);
            }}
          />
        ) : null}
        {renderPage()}
      </AppShell>

      {currentView !== "project" && selectedTask ? (
        <ConnectedTaskDetailPanel
          key={selectedTask.id}
          task={selectedTask}
          userId={user.uid}
          projects={editableProjects}
          taskActions={taskActions}
          onClose={() => setSelectedTaskId(null)}
          onOpenProject={openTaskInProject}
          formatSettings={settings.time}
          browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
          defaultReminderMinutes={settings.reminder.defaultTime}
        />
      ) : null}

      {currentView !== "project" && composer.open ? (
        <TaskComposerDialog
          open
          onClose={closeComposer}
          onSubmit={handleComposerSubmit}
          initialValues={composer.initialValues}
          workType={composer.workType}
          userId={user.uid}
          projects={editableProjects}
          formatSettings={settings.time}
          browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
          defaultReminderMinutes={settings.reminder.defaultTime}
        />
      ) : null}

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={searchItems}
        onSelect={handleSearchSelect}
      />

      {reminderNotice ? (
        <aside className="toast" role="status" aria-live="assertive">
          <div className="toast-body">
            <strong className="toast-title">Task reminder</strong>
            <p className="toast-text">{reminderNotice.title}</p>
          </div>
          <IconButton
            label="Dismiss reminder"
            size="sm"
            onClick={() => setReminderNotice(null)}
          >
            <Icon name="x" />
          </IconButton>
        </aside>
      ) : null}
    </>
  );
}

export default App;
