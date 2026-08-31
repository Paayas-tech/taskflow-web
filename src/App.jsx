import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import ArchivedTasksPage from "./ArchivedTasksPage";
import ConfigurationErrorScreen from "./ConfigurationErrorScreen";
import Dashboard from "./Dashboard";
import DashboardInviteModal from "./DashboardInviteModal";
import GlobalTopNav from "./GlobalTopNav";
import InboxPage from "./InboxPage";
import Login from "./Login";
import Onboarding from "./Onboarding";
import NotificationsPanel from "./NotificationsPanel";
import ProfileCompletionPrompt from "./ProfileCompletionPrompt";
import ProjectsPage from "./ProjectsPage";
import ProjectTasksPage from "./ProjectTasksPage";
import Recover from "./Recover";
import SettingsPage from "./SettingsPage";
import TaskForm from "./TaskForm";
import TaskEditModal from "./TaskEditModal";
import TasksPage from "./TasksPage";
import WorkspacePage from "./WorkspacePage";
import PlanningPage from "./PlanningPage";
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
  getLists,
  createList,
  updateList,
  deleteList,
} from "./application/listService";
import {
  createProject,
  createProjectTask,
  acceptProjectInvitation,
  declineProjectInvitation,
  deleteProject,
  getAssignedProjectTasks,
  getProjects,
  getUserInvitations,
  updateProject,
} from "./application/projectService";
import { createReminderScheduler } from "./services/reminderService";
import { getSettings, saveSettings } from "./application/settingsService";
import {
  defaultViewPath,
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
import { isTaskComplete } from "./domain/taskDomain";
import {
  recordRecentItem,
  toggleStarredItem,
  workspaceItemForProject,
  workspaceItemForTask,
} from "./domain/workspaceNavigationDomain";
import { isSupabaseConfigured } from "./infrastructure/supabase/client";
import {
  isNavigationItemActive,
  navigationItems,
  normalizePath,
  pageMetadata,
  projectIdFromPath,
  projectPath,
  routeViewFromPath,
} from "./app/appRoutes";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";

const navIcons = {
  "for-you": <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  recent: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  starred: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
  timeline: <><path d="M5 5v14M5 8h7M5 13h12M5 18h9" /></>,
  board: <><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></>,
  lists: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></>,
  goals: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m12 12 6-6" /></>,
  issues: <><path d="M12 3 2.8 20h18.4ZM12 9v4M12 17h.01" /></>,
  pages: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  today: (
    <>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
      <path d="m9 15 2 2 4-5" />
    </>
  ),
  tasks: (
    <>
      <path d="m4 7 2 2 3-4M12 7h8M4 15l2 2 3-4M12 15h8" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7.5h18M5 4h5l2 3.5h7a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </>
  ),
  calendar: (
    <>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
    </>
  ),
  reminders: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.3V9.55h.1A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 3.7l.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1v-.1h4.05v.1A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.5c.12.4.34.74.66 1 .3.25.7.4 1.1.4h.1v4.05h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
};

function NavigationIcon({ name }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        {navIcons[name]}
      </svg>
    </span>
  );
}

const updateSettingsLastViewed = (settings, path) => ({
  ...settings,
  navigation: {
    ...settings.navigation,
    lastViewedPath: path,
  },
});

const emptyTaskForm = {
  title: "",
  description: "",
  notes: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  reminder: false,
  reminderAt: "",
  listId: "",
  projectId: "",
};

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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configurationUnavailable, setConfigurationUnavailable] = useState(
    !isSupabaseConfigured
  );
  const [signOutState, setSignOutState] = useState({
    pending: false,
    error: "",
  });
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
  const [listsLoading, setListsLoading] = useState(false);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [listsError, setListsError] = useState("");
  const [lists, setLists] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectCreateRequest, setProjectCreateRequest] = useState(0);
  const [projectTaskRefreshToken, setProjectTaskRefreshToken] = useState(0);
  const [projectItemOpenRequest, setProjectItemOpenRequest] = useState(null);
  const [projectPageView, setProjectPageView] = useState("overview");
  const [projects, setProjects] = useState([]);
  const [assignedProjectTasks, setAssignedProjectTasks] = useState([]);
  const [assignedProjectTasksLoading, setAssignedProjectTasksLoading] = useState(false);
  const [assignedProjectTasksError, setAssignedProjectTasksError] = useState("");
  const [projectInvitations, setProjectInvitations] = useState([]);
  const [projectInvitationsLoading, setProjectInvitationsLoading] = useState(false);
  const [projectInvitationsError, setProjectInvitationsError] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [dashboardTaskView, setDashboardTaskView] = useState("upcoming");
  const [dashboardQuickCreateOpen, setDashboardQuickCreateOpen] = useState(false);
  const [dashboardTaskOpenRequest, setDashboardTaskOpenRequest] = useState(null);
  const [taskFilterRequest, setTaskFilterRequest] = useState(null);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState("");
  const [dashboardChartPeriod, setDashboardChartPeriod] = useState("7-days");
  const [dashboardSummaryPeriod, setDashboardSummaryPeriod] = useState("week");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage?.getItem("taskflow:sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [dashboardInviteOpen, setDashboardInviteOpen] = useState(false);
  const [workspaceSelectedTask, setWorkspaceSelectedTask] = useState(null);
  const [taskFormSaving, setTaskFormSaving] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [settings, setSettings] = useState(() => normalizeSettings());
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState("");
  const [settingsLoadedUserId, setSettingsLoadedUserId] = useState("");
  const [profileSettingsRequest, setProfileSettingsRequest] = useState(0);
  const [dismissedProfilePromptUserId, setDismissedProfilePromptUserId] = useState("");
  const [reminderNotice, setReminderNotice] = useState(null);
  const [quickTaskPendingIds, setQuickTaskPendingIds] = useState(
    () => new Set()
  );

  useEffect(() => {
    if (!settingsSheetOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSettingsSheetOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsSheetOpen]);

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
        if (active) setGoogleCalendarEvents(Array.isArray(result.events) ? result.events : []);
      } catch (error) {
        console.warn("Google Calendar events could not be refreshed", error);
      }
    })();
    return () => { active = false; };
  }, [currentPath, user]);
  const newTaskButtonRef = useRef(null);
  const newProjectButtonRef = useRef(null);
  const taskModalRef = useRef(null);
  const taskModalInitialFocusRef = useRef(null);
  const taskFormSubmissionRef = useRef(false);
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

  const loadLists = useCallback(async () => {
    if (!user) return;
    const requestUserId = user.uid;

    setListsLoading(true);
    setListsLoaded(false);
    setListsError("");

    try {
      const userLists = await getLists(requestUserId);
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      setLists(userLists);
    } catch (error) {
      if (!isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        return;
      }
      console.error("Error loading lists:", error);
      setLists([]);
      setListsError(
        "We couldn't load your lists. Check your connection and try again."
      );
    } finally {
      if (isCurrentAuthRequest(authenticatedUserIdRef.current, requestUserId)) {
        setListsLoading(false);
        setListsLoaded(true);
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
        setLists([]);
        setListsLoaded(false);
        setListsError("");
        setListsLoading(false);
        setProjects([]);
        setProjectsError("");
        setProjectsLoading(false);
        setAssignedProjectTasks([]);
        setAssignedProjectTasksError("");
        setAssignedProjectTasksLoading(false);
        setProjectInvitations([]);
        setProjectInvitationsError("");
        setProjectInvitationsLoading(false);
        setShowTaskForm(false);
        setTaskForm(emptyTaskForm);
        setTaskFormError("");
        setTaskFormSaving(false);
        setReminderNotice(null);
        setDeleteAccountState({ pending: false, error: "" });

        const fallbackSettings = normalizeSettings(
          {},
          currentUser || undefined
        );
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
      loadLists();
      loadProjects();
      loadAssignedProjectTasks();
      loadProjectInvitations();
      loadSettings();
    }
  }, [
    user,
    loadTasks,
    loadLists,
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
      document.documentElement.dataset.themePreference = settings.theme.mode;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();
    if (settings.theme.mode !== "system") return undefined;

    mediaQuery.addEventListener?.("change", applyTheme);
    return () => mediaQuery.removeEventListener?.("change", applyTheme);
  }, [settings.theme.mode]);

  useEffect(() => {
    document.documentElement.dataset.background = settings.background.selected;
  }, [settings.background.selected]);

  useEffect(() => {
    document.documentElement.lang = settings.language.code;
  }, [settings.language.code]);

  useEffect(() => {
    const defaultListId = settings.taskDefaults.listId;
    if (
      !user ||
      !listsLoaded ||
      !defaultListId ||
      lists.some((list) => list.id === defaultListId)
    ) {
      return;
    }

    const nextSettings = {
      ...settings,
      taskDefaults: { ...settings.taskDefaults, listId: null },
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    void saveSettings(user, nextSettings).catch((error) => {
      console.error("Error resetting an unavailable default list:", error);
    });
  }, [lists, listsLoaded, settings, user]);

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

  const handleTaskChange = (event) => {
    const { name, value, type, checked } = event.target;

    setTaskForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (taskFormSubmissionRef.current) return;

    taskFormSubmissionRef.current = true;
    setTaskFormError("");

    if (!taskForm.title.trim()) {
      setTaskFormError("Enter a task title before saving.");
      taskFormSubmissionRef.current = false;
      return;
    }

    setTaskFormSaving(true);

    try {
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        notes: taskForm.notes,
        status: taskForm.status,
        completed: taskForm.status === "completed",
        priority: taskForm.priority,
        dueDate: taskForm.dueDate,
        endDate: taskForm.endDate,
        startTime: taskForm.startTime,
        endTime: taskForm.endTime,
        reminder: taskForm.reminder,
        reminderAt: taskForm.reminderAt,
        listId: taskForm.listId || null,
        projectId: taskForm.projectId || null,
      };

      if (taskData.projectId) {
        await createProjectTask(user.uid, taskData.projectId, taskData);
        setProjectTaskRefreshToken((token) => token + 1);
      } else {
        await createTask(user.uid, taskData);
      }

      setTaskForm(emptyTaskForm);
      setShowTaskForm(false);
      if (!taskData.projectId) await loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      setTaskFormError(
        "We couldn't create this task. Check your connection and try again."
      );
    } finally {
      taskFormSubmissionRef.current = false;
      setTaskFormSaving(false);
    }
  };

  const handleUpdateTask = useCallback(
    async (taskId, data) => {
      if (!user) {
        throw new Error("You must be signed in to update a task.");
      }

      await updateTask(user.uid, taskId, data);
      await loadTasks();
      if (data.projectId) setProjectTaskRefreshToken((token) => token + 1);
    },
    [user, loadTasks]
  );

  const handleQuickUpdateTask = useCallback(
    (taskId, data) => {
      if (!user) {
        return Promise.reject(
          new Error("You must be signed in to update a task.")
        );
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

  const handleDeleteTask = useCallback(
    async (taskId) => {
      if (!user) {
        throw new Error("You must be signed in to delete a task.");
      }

      await deleteTask(user.uid, taskId);
      await loadTasks();
    },
    [user, loadTasks]
  );

  const handleArchiveTask = useCallback(
    async (taskId) => {
      if (!user) {
        throw new Error("You must be signed in to archive a task.");
      }

      await archiveTask(user.uid, taskId);
      await loadTasks();
    },
    [user, loadTasks]
  );

  const handleRestoreTask = useCallback(
    async (taskId) => {
      if (!user) {
        throw new Error("You must be signed in to restore a task.");
      }

      await unarchiveTask(user.uid, taskId);
      await loadTasks();
    },
    [user, loadTasks]
  );

  const handleCreateList = useCallback(
    async (data) => {
      if (!user) {
        throw new Error("You must be signed in to create a list.");
      }

      const listReference = await createList(user.uid, {
        ...data,
        position: lists.length,
      });
      await loadLists();
      return listReference.id;
    },
    [user, lists.length, loadLists]
  );

  const handleRenameList = useCallback(
    async (listId, data) => {
      if (!user) {
        throw new Error("You must be signed in to rename a list.");
      }

      await updateList(user.uid, listId, data);
      await loadLists();
    },
    [user, loadLists]
  );

  const handleDeleteList = useCallback(
    async (listId) => {
      if (!user) {
        throw new Error("You must be signed in to delete a list.");
      }

      await deleteList(user.uid, listId);
      await Promise.all([loadLists(), loadTasks()]);
    },
    [user, loadLists, loadTasks]
  );

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
      await attachmentService.removeAll({ projectId, entityType: "project", entityId: projectId });
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
          result.profileUpdated
            ? "Changes saved."
            : "Saved locally."
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

  const openTaskForm = (initialValues = {}) => {
    setTaskFormError("");
    const defaultListId = settings.taskDefaults.listId;
    const validDefaultListId = lists.some((list) => list.id === defaultListId)
      ? defaultListId
      : "";
    setTaskForm({
      ...emptyTaskForm,
      listId: validDefaultListId,
      ...initialValues,
    });
    setShowTaskForm(true);
  };

  const handleDashboardQuickCreate = async (title, initialValues = {}) => {
    const defaultListId = settings.taskDefaults.listId;
    const validDefaultListId = lists.some((list) => list.id === defaultListId)
      ? defaultListId
      : null;
    await createTask(user.uid, {
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
      listId: validDefaultListId,
      projectId: null,
      ...initialValues,
      title,
    });
    await loadTasks();
  };

  const handleDashboardCreateStart = (title = "", showDetails = false) => {
    if (showDetails) {
      setDashboardQuickCreateOpen(false);
      openTaskForm(title ? { title } : {});
      return;
    }
    setDashboardQuickCreateOpen(true);
  };

  const closeTaskForm = useCallback(() => {
    if (taskFormSaving) return;

    setTaskFormError("");
    setTaskForm(emptyTaskForm);
    setShowTaskForm(false);
  }, [taskFormSaving]);

  const { onBackdropMouseDown: handleTaskModalBackdrop } = useModalLifecycle({
    isOpen: showTaskForm,
    modalRef: taskModalRef,
    onClose: closeTaskForm,
    triggerRef: newTaskButtonRef,
    initialFocusRef: taskModalInitialFocusRef,
    isDismissDisabled: taskFormSaving,
    allowEscape: true,
    allowBackdropDismiss: true,
    restoreFocus: true,
    lockBodyScroll: true,
  });

  const navigate = (path, { recordProject = true } = {}) => {
    if (path === currentPath) return;

    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "auto" });

    if (path === "/" && user) {
      void loadAssignedProjectTasks();
    }

    if (user) {
      let nextSettings = settingsRef.current;
      const openedProjectId = projectIdFromPath(path);
      const openedProject = openedProjectId
        ? projects.find((project) => project.id === openedProjectId)
        : null;
      if (openedProject && recordProject) {
        nextSettings = {
          ...nextSettings,
          data: {
            ...nextSettings.data,
            workspaceNavigation: recordRecentItem(
              nextSettings.data?.workspaceNavigation,
              workspaceItemForProject(openedProject)
            ),
          },
        };
      }
      if (["/", "/inbox", "/tasks", "/projects", "/calendar", "/for-you", "/recent", "/starred", "/planning/timeline", "/planning/board", "/planning/lists", "/planning/goals", "/planning/issues"].includes(path)) {
        nextSettings = updateSettingsLastViewed(nextSettings, path);
      }
      if (nextSettings === settingsRef.current) return;
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      void saveSettings(user, nextSettings).catch((error) => {
        console.error("Error remembering the last viewed page:", error);
      });
    }
  };

  const updateWorkspaceNavigation = (updater) => {
    const currentSettings = settingsRef.current;
    const nextSettings = {
      ...currentSettings,
      data: {
        ...currentSettings.data,
        workspaceNavigation: updater(currentSettings.data?.workspaceNavigation || {}),
      },
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    void saveSettings(user, nextSettings).catch((error) => {
      console.error("Error saving workspace navigation:", error);
    });
  };

  const handleWorkspaceItemOpen = (item) => {
    if (item.type === "project") {
      navigate(projectPath(item.id));
      return;
    }
    updateWorkspaceNavigation((data) => recordRecentItem(data, item));
    if (item.projectId) {
      setProjectItemOpenRequest({ projectId: item.projectId, itemId: item.id, request: Date.now() });
      navigate(projectPath(item.projectId), { recordProject: false });
      return;
    }
    const task = activeTasks.find((candidate) => candidate.id === item.id);
    if (task) setWorkspaceSelectedTask(task);
  };

  const handleWorkspaceStarToggle = (item) => {
    updateWorkspaceNavigation((data) => toggleStarredItem(data, item));
  };

  const handlePlanningGoalsChange = (goals) => {
    const currentSettings = settingsRef.current;
    const nextSettings = {
      ...currentSettings,
      data: { ...currentSettings.data, planningGoals: goals },
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    void saveSettings(user, nextSettings).catch((error) => {
      console.error("Error saving planning goals:", error);
    });
  };

  if (configurationUnavailable) {
    return (
      <ConfigurationErrorScreen onRetry={() => window.location.reload()} />
    );
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

  if (
    shouldWaitForOnboardingSettings(
      user,
      settingsLoading,
      settingsLoadedUserId
    )
  ) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (
    user.onboardingRequired &&
    !settingsLoading &&
    settingsLoadedUserId === user.uid
  ) {
    return (
      <Onboarding
        displayName={settings.profile.displayName || user.displayName}
        saving={onboardingSaving}
        onComplete={handleOnboardingComplete}
        onStartOver={handleRestartSignup}
      />
    );
  }

  const selectedProjectId = projectIdFromPath(currentPath);
  const activeTasks = filterActiveTasks(tasks);
  const archivedTasks = filterArchivedTasks(tasks);
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );
  const editableProjects = projects.filter((project) =>
    ["owner", "editor"].includes(project.viewerRole)
  );
  const currentView = routeViewFromPath(currentPath);
  const dashboardSelectedTask = activeTasks.find(
    (task) => task.id === dashboardTaskOpenRequest?.id
  );
  const { title: pageTitle, subtitle: pageSubtitle } = pageMetadata({
    currentView,
    taskCount: tasks.length,
    archivedTaskCount: archivedTasks.length,
    projectCount: projects.length,
    selectedProject,
    projectsLoading,
  });
  const renderNavigationItem = (item) => {
    const isActive = isNavigationItemActive(item.path, currentPath, currentView);
    return (
      <button
        key={item.label}
        type="button"
        className={`nav-item ${isActive ? "active" : ""} ${item.enabled ? "" : "nav-item-disabled"}`}
        disabled={!item.enabled}
        aria-current={isActive ? "page" : undefined}
        aria-label={item.enabled ? item.label : `${item.label}, coming soon`}
        onClick={() => item.enabled && navigate(item.path)}
      >
        <span className="nav-item-main"><NavigationIcon name={item.icon} /><span>{item.label}</span></span>
        {!item.enabled && <small>Soon</small>}
        {item.label === "Projects" && projectInvitations.length > 0 && <small aria-label={`${projectInvitations.length} pending invitations`}>{projectInvitations.length}</small>}
      </button>
    );
  };

  const scrollProjectPageTo = (selector) => {
    window.requestAnimationFrame(() => {
      document.querySelector(selector)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  };

  const openProjectPageSection = (section) => {
    if (!selectedProject) {
      navigate("/projects");
      return;
    }

    setProjectPageView(section);
    scrollProjectPageTo(section === "overview" ? ".project-task-hero" : ".project-view-toolbar");
  };

  const globalSearchItems = [
    ...projects.map((candidate) => ({
      id: candidate.id,
      type: "project",
      title: candidate.name,
      subtitle: candidate.description || "Project",
      item: candidate,
    })),
    ...activeTasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      subtitle: "Personal task",
      item: task,
    })),
    ...assignedProjectTasks.map((task) => ({
      id: task.id,
      type: task.workType === "story" ? "story" : "task",
      title: task.title,
      subtitle: projects.find((candidate) => candidate.id === task.projectId)?.name || "Project work",
      item: task,
    })),
  ].filter((item, index, items) => items.findIndex((candidate) =>
    candidate.type === item.type && candidate.id === item.id
  ) === index);

  const handleGlobalSearchOpen = (result) => {
    if (result.type === "home") {
      navigate("/");
      return;
    }
    if (result.type === "project") {
      navigate(projectPath(result.id));
      return;
    }
    handleWorkspaceItemOpen(workspaceItemForTask(result.item));
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

  const globalCreateActions = [
    {
      label: "Task",
      description: selectedProject ? `Add to ${selectedProject.name}` : "Create a personal task",
      onSelect: () => openTaskForm(selectedProject ? { projectId: selectedProject.id } : {}),
    },
    {
      label: "Project",
      description: "Create a collaborative workspace",
      onSelect: () => {
        setProjectCreateRequest((request) => request + 1);
        navigate("/projects");
      },
    },
  ];

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <GlobalTopNav
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        searchItems={globalSearchItems}
        onOpenSearchItem={handleGlobalSearchOpen}
        createActions={globalCreateActions}
        notificationControl={<NotificationsPanel userId={user.uid} onNavigate={navigate} />}
        displayName={settings.profile.displayName || user.displayName || user.user_metadata?.display_name || user.email}
        email={user.email}
        onOpenSettings={() => setSettingsSheetOpen(true)}
      />
      <aside className="sidebar">
        <nav className="nav-list" aria-label="Primary navigation">
          <p className="nav-section-label">Workspace</p>
          {navigationItems.filter((item) => item.label === "Dashboard").map(renderNavigationItem)}
          {navigationItems.filter((item) => item.group === "workspace").map(renderNavigationItem)}
          <p className="nav-section-label">Planning</p>
          {navigationItems.filter((item) => item.group === "planning").map(renderNavigationItem)}
          <section className="project-pages-nav" aria-label={`${selectedProject?.name || "Projects"} project pages`}>
            <p className="nav-section-label">Project pages</p>
            <button className={`nav-item project-page-nav-item${currentView === "project" && projectPageView === "overview" ? " active" : ""}`} type="button" aria-current={currentView === "project" && projectPageView === "overview" ? "page" : undefined} onClick={() => openProjectPageSection("overview")}>
              <span className="nav-item-main"><NavigationIcon name="pages" /><span>Project pages</span></span>
            </button>
            <button className={`nav-item project-page-nav-item${currentView === "project" && projectPageView === "board" ? " active" : ""}`} type="button" aria-current={currentView === "project" && projectPageView === "board" ? "page" : undefined} onClick={() => openProjectPageSection("board")}>
              <span className="nav-item-main"><NavigationIcon name="board" /><span>Board</span></span>
            </button>
            <button className={`nav-item project-page-nav-item${currentView === "project" && projectPageView === "list" ? " active" : ""}`} type="button" aria-current={currentView === "project" && projectPageView === "list" ? "page" : undefined} onClick={() => openProjectPageSection("list")}>
              <span className="nav-item-main"><NavigationIcon name="lists" /><span>Lists</span></span>
            </button>
          </section>
          {navigationItems.filter((item) => !item.group && !["Dashboard", "Projects", "Settings"].includes(item.label)).map(renderNavigationItem)}
        </nav>

        {signOutState.error && <p className="signout-error sidebar-signout-error" role="alert">{signOutState.error}</p>}
      </aside>

      <main className={`main-content view-${currentView}`}>
        {currentView !== "project" && currentView !== "dashboard" && currentView !== "tasks" && currentView !== "archived" && <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>

        </header>}

        {!settingsLoading &&
          settingsLoadedUserId === user.uid &&
          !String(settings.profile.displayName || "").trim() &&
          dismissedProfilePromptUserId !== user.uid &&
          !wasProfilePromptDismissed(user.uid) && (
            <ProfileCompletionPrompt
              displayName={settings.profile.displayName}
              onOpenProfile={() => {
                setProfileSettingsRequest((request) => request + 1);
                navigate("/settings");
              }}
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
          )}

        {showTaskForm && (
          <div
            className="task-modal-backdrop"
            onMouseDown={handleTaskModalBackdrop}
          >
            <section
              ref={taskModalRef}
              className="task-modal"
              id="create-task-dialog"
              role="dialog"
              tabIndex={-1}
              aria-modal="true"
              aria-labelledby="create-task-dialog-title"
              aria-describedby="create-task-dialog-description"
              aria-busy={taskFormSaving}
            >
              <div className="task-modal-header">
                <div>
                  <p className="card-label">New task</p>
                  <h2 id="create-task-dialog-title">Create Task</h2>
                  <p id="create-task-dialog-description">
                    Add the details now, then adjust them anytime from Tasks.
                  </p>
                </div>

                <button
                  ref={taskModalInitialFocusRef}
                  className="ghost-btn compact-btn task-modal-close"
                  type="button"
                  onClick={closeTaskForm}
                  disabled={taskFormSaving}
                  aria-label="Close Create Task dialog"
                >
                  Close
                </button>
              </div>

              <TaskForm
                values={taskForm}
                onChange={handleTaskChange}
                onSubmit={handleCreateTask}
                onCancel={closeTaskForm}
                submitLabel="Create Task"
                busyLabel="Creating..."
                busy={taskFormSaving}
                error={taskFormError}
                lists={lists}
                projects={editableProjects}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
                onRetryProjects={loadProjects}
                defaultReminderMinutes={settings.reminder.defaultTime}
                browserNotificationsEnabled={
                  settings.reminder.enableBrowserNotifications
                }
              />
            </section>
          </div>
        )}

        {["for-you", "recent", "starred"].includes(currentView) && (
          <WorkspacePage
            mode={currentView}
            tasks={activeTasks}
            assignedTasks={assignedProjectTasks}
            projects={projects}
            workspaceData={settings.data?.workspaceNavigation}
            onOpenItem={handleWorkspaceItemOpen}
            onToggleStar={handleWorkspaceStarToggle}
          />
        )}

        {currentView.startsWith("planning-") && (
          <PlanningPage
            view={currentView.replace("planning-", "")}
            tasks={activeTasks}
            assignedTasks={assignedProjectTasks}
            projects={projects}
            workspaceData={settings.data?.workspaceNavigation}
            goals={settings.data?.planningGoals}
            onGoalsChange={handlePlanningGoalsChange}
            onOpenItem={handleWorkspaceItemOpen}
            onToggleStar={handleWorkspaceStarToggle}
          />
        )}

        {(["for-you", "recent", "starred"].includes(currentView) || currentView.startsWith("planning-")) && workspaceSelectedTask && (
          <TaskEditModal
            key={workspaceSelectedTask.id}
            task={workspaceSelectedTask}
            lists={lists}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onArchiveTask={handleArchiveTask}
            onClose={() => setWorkspaceSelectedTask(null)}
            presentation="panel"
          />
        )}

        <div className="route-content" hidden={currentView !== "tasks"}>
          <TasksPage
            tasks={activeTasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            onArchiveTask={handleArchiveTask}
            onInlineCreateTask={handleDashboardQuickCreate}
            onCreateScheduledTask={(schedule) => openTaskForm(schedule)}
            createTaskTriggerRef={newTaskButtonRef}
            openTaskRequest={dashboardTaskOpenRequest}
            filterRequest={taskFilterRequest}
            lists={lists}
            listsLoading={listsLoading}
            listsError={listsError}
            onRetryLists={loadLists}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            formatSettings={settings.time}
            weekStartsOn={weekStartIndex(settings.time.weekStartsOn)}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
            initialWorkspaceView={currentPath === "/calendar" ? "calendar" : "list"}
            externalCalendarEvents={googleCalendarEvents}
            onWorkspaceViewChange={(view) => navigate(view === "calendar" ? "/calendar" : "/tasks")}
          />
        </div>

        <div className="route-content" hidden={currentView !== "projects"}>
          <ProjectsPage
            userId={user.uid}
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            onRetry={loadProjects}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            createRequest={projectCreateRequest}
            createTriggerRef={newProjectButtonRef}
            onOpenProject={(projectId) =>
              navigate(projectPath(projectId))
            }
            invitations={projectInvitations}
            invitationsLoading={projectInvitationsLoading}
            invitationsError={projectInvitationsError}
            onRetryInvitations={loadProjectInvitations}
            onAcceptInvitation={handleAcceptProjectInvitation}
            onDeclineInvitation={handleDeclineProjectInvitation}
          />
        </div>

        {currentView === "project" && (
          <ProjectTasksPage
            userId={user.uid}
            projectId={selectedProjectId}
            project={selectedProject}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            lists={lists}
            formatSettings={settings.time}
            refreshToken={projectTaskRefreshToken}
            openItemRequest={projectItemOpenRequest}
            showEmbeddedTaskViews
            requestedView={projectPageView === "list" ? "list" : "board"}
            onViewChange={setProjectPageView}
            onItemOpened={(task) => updateWorkspaceNavigation((data) => recordRecentItem(data, workspaceItemForTask(task)))}
            onBack={() => navigate("/projects")}
            onCreateTask={() =>
              openTaskForm({ projectId: selectedProject.id })
            }
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
          />
        )}

        <div className="route-content" hidden={currentView !== "dashboard"}>
          <Dashboard
            tasks={activeTasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            myDaySettings={settings.myDay}
            assignedTasks={assignedProjectTasks}
            assignedTasksLoading={assignedProjectTasksLoading}
            assignedTasksError={assignedProjectTasksError}
            onRetryAssignedTasks={loadAssignedProjectTasks}
            accessibleProjectCount={projects.length}
            pendingInvitations={projectInvitations}
            invitationsLoading={projectInvitationsLoading}
            invitationsError={projectInvitationsError}
            onOpenProject={(projectId) =>
              navigate(projectPath(projectId))
            }
            onOpenInvitations={() => setDashboardInviteOpen(true)}
            displayName={
              settings.profile.displayName ||
              user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              "there"
            }
            taskView={dashboardTaskView}
            onTaskViewChange={setDashboardTaskView}
            quickCreateOpen={dashboardQuickCreateOpen}
            onStartQuickCreate={handleDashboardCreateStart}
            onQuickCreate={handleDashboardQuickCreate}
            onCancelQuickCreate={() => setDashboardQuickCreateOpen(false)}
            onOpenTask={(task) => {
              updateWorkspaceNavigation((data) => recordRecentItem(data, workspaceItemForTask(task)));
              setDashboardTaskOpenRequest({ id: task.id, request: Date.now() });
            }}
            onFilterTasks={(filters) => {
              setDashboardTaskOpenRequest(null);
              setTaskFilterRequest({ ...filters, request: Date.now() });
              navigate("/tasks");
            }}
            onViewAllTasks={() => navigate("/tasks")}
            onViewAllProjects={() => navigate("/projects")}
            notificationControl={null}
            showGlobalActions={false}
            searchQuery={dashboardSearchQuery}
            onSearchChange={setDashboardSearchQuery}
            chartPeriod={dashboardChartPeriod}
            onChartPeriodChange={setDashboardChartPeriod}
            summaryPeriod={dashboardSummaryPeriod}
            onSummaryPeriodChange={setDashboardSummaryPeriod}
            onToggleTask={(task) => {
              const completing = !isTaskComplete(task);
              return handleQuickUpdateTask(task.id, {
                completed: completing,
                status: completing ? "completed" : "todo",
                completedAt: completing ? new Date().toISOString() : null,
              });
            }}
            quickTaskPendingIds={quickTaskPendingIds}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            onCreateProject={() => {
              setProjectCreateRequest((request) => request + 1);
              navigate("/projects");
            }}
          />
          {currentView === "dashboard" && dashboardSelectedTask && (
            <TaskEditModal
              key={dashboardSelectedTask.id}
              task={dashboardSelectedTask}
              lists={lists}
              projects={projects}
              projectsLoading={projectsLoading}
              projectsError={projectsError}
              onRetryProjects={loadProjects}
              browserNotificationsEnabled={settings.reminder.enableBrowserNotifications}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onArchiveTask={handleArchiveTask}
              onClose={() => setDashboardTaskOpenRequest(null)}
              presentation="panel"
            />
          )}
          {currentView === "dashboard" && dashboardInviteOpen && (
            <DashboardInviteModal userId={user.uid} projects={projects} onClose={() => setDashboardInviteOpen(false)} />
          )}
        </div>

        <div className="route-content" hidden={currentView !== "inbox"}>
          <InboxPage userId={user.uid} onNavigate={navigate} />
        </div>

        <div className="route-content" hidden={currentView !== "settings"}>
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
            onOpenProjectCreate={() => {
              setProjectCreateRequest((request) => request + 1);
              navigate("/projects");
            }}
            onRestoreProject={handleRestoreProject}
            exportData={{
              version: 1,
              exportedAt: new Date().toISOString(),
              settings,
              tasks,
              lists,
              projects,
            }}
            onGoogleEventsChange={setGoogleCalendarEvents}
          />
        </div>

        <div className="route-content" hidden={currentView !== "archived"}>
          <ArchivedTasksPage
            tasks={archivedTasks}
            loading={tasksLoading}
            error={tasksError}
            onRetry={loadTasks}
            onRestoreTask={handleRestoreTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onBack={() => setSettingsSheetOpen(true)}
            onViewTasks={() => navigate("/tasks")}
            lists={lists}
            projects={editableProjects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            formatSettings={settings.time}
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
          />
        </div>
      </main>

      {settingsSheetOpen && (
        <div
          className="settings-sheet-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setSettingsSheetOpen(false)}
        >
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="TaskFlow settings">
            <button className="settings-sheet-close" type="button" onClick={() => setSettingsSheetOpen(false)} aria-label="Close settings" title="Close">×</button>
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
              onNavigate={(path) => { setSettingsSheetOpen(false); navigate(path); }}
              profileRequest={profileSettingsRequest}
              onOpenProjectCreate={() => {
                setSettingsSheetOpen(false);
                setProjectCreateRequest((request) => request + 1);
                navigate("/projects");
              }}
              onRestoreProject={handleRestoreProject}
              exportData={{
                version: 1,
                exportedAt: new Date().toISOString(),
                settings,
                tasks,
                lists,
                projects,
              }}
              onGoogleEventsChange={setGoogleCalendarEvents}
            />
          </section>
        </div>
      )}

      {reminderNotice && (
        <aside className="reminder-toast" role="status" aria-live="assertive">
          <span className="reminder-toast-icon" aria-hidden="true">!</span>
          <div>
            <strong>Task reminder</strong>
            <p>{reminderNotice.title}</p>
          </div>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => setReminderNotice(null)}
            aria-label="Dismiss reminder"
          >
            Dismiss
          </button>
        </aside>
      )}
    </div>
  );
}

export default App;
