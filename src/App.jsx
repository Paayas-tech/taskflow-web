import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import ArchivedTasksPage from "./ArchivedTasksPage";
import CalendarPage from "./CalendarPage";
import ConfigurationErrorScreen from "./ConfigurationErrorScreen";
import Dashboard from "./Dashboard";
import Login from "./Login";
import NotificationsPanel from "./NotificationsPanel";
import ProjectsPage from "./ProjectsPage";
import ProjectTasksPage from "./ProjectTasksPage";
import Recover from "./Recover";
import SettingsPage from "./SettingsPage";
import TaskForm from "./TaskForm";
import TasksPage from "./TasksPage";
import TodayPage from "./TodayPage";
import {
  onAuthStateChange,
  signOut,
} from "./application/authService";
import { createSignOutController } from "./application/signOutController";
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
import { isCurrentAuthRequest } from "./domain/authDomain";
import {
  filterActiveTasks,
  filterArchivedTasks,
} from "./domain/archivedTasksDomain";
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

const navIcons = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
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
  const [passwordRecoverySession, setPasswordRecoverySession] = useState(false);
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
  const [projects, setProjects] = useState([]);
  const [assignedProjectTasks, setAssignedProjectTasks] = useState([]);
  const [assignedProjectTasksLoading, setAssignedProjectTasksLoading] = useState(false);
  const [assignedProjectTasksError, setAssignedProjectTasksError] = useState("");
  const [projectInvitations, setProjectInvitations] = useState([]);
  const [projectInvitationsLoading, setProjectInvitationsLoading] = useState(false);
  const [projectInvitationsError, setProjectInvitationsError] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormSaving, setTaskFormSaving] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [settings, setSettings] = useState(() => normalizeSettings());
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState("");
  const [reminderNotice, setReminderNotice] = useState(null);
  const [quickTaskPendingIds, setQuickTaskPendingIds] = useState(
    () => new Set()
  );
  const newTaskButtonRef = useRef(null);
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
    void signOutControllerRef.current.run();
  }, []);

  const handleSignInSuccess = useCallback(() => {
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
      }
      authenticatedUserIdRef.current = nextUserId;
      setUser(currentUser);
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
          ? "Settings saved to your TaskFlow account."
          : "Settings saved. Your display name will sync when you're online."
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

  const closeTaskForm = useCallback(() => {
    if (taskFormSaving) return;

    setTaskFormError("");
    setTaskForm(emptyTaskForm);
    setShowTaskForm(false);
    newTaskButtonRef.current?.focus();
  }, [taskFormSaving]);

  const handleTaskModalBackdrop = (event) => {
    if (event.target === event.currentTarget) closeTaskForm();
  };

  useEffect(() => {
    if (!showTaskForm) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !taskFormSaving) closeTaskForm();

      if (event.key === "Tab") {
        const dialog = document.getElementById("create-task-dialog");
        const focusableElements = dialog?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      document
        .getElementById("create-task-dialog")
        ?.querySelector(
          'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)'
        )
        ?.focus();
    });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTaskForm, showTaskForm, taskFormSaving]);

  const navigate = (path) => {
    if (path === currentPath) return;

    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "auto" });

    if (path === "/" && user) {
      void loadAssignedProjectTasks();
    }

    if (
      user &&
      ["/", "/today", "/tasks", "/projects", "/calendar"].includes(path)
    ) {
      const nextSettings = updateSettingsLastViewed(settingsRef.current, path);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      void saveSettings(user, nextSettings).catch((error) => {
        console.error("Error remembering the last viewed page:", error);
      });
    }
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
        onSignInSuccess={handleSignInSuccess}
        onRecoverPassword={() => navigate("/recover")}
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
  const { title: pageTitle, subtitle: pageSubtitle } = pageMetadata({
    currentView,
    taskCount: tasks.length,
    archivedTaskCount: archivedTasks.length,
    projectCount: projects.length,
    selectedProject,
    projectsLoading,
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand">TaskFlow</div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigationItems.map((item) => {
            const isActive = isNavigationItemActive(
              item.path,
              currentPath,
              currentView
            );

            return (
              <button
              key={item.label}
              type="button"
              className={`nav-item ${
                isActive ? "active" : ""
              } ${item.enabled ? "" : "nav-item-disabled"}`}
              disabled={!item.enabled}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.enabled ? item.label : `${item.label}, coming soon`}
              onClick={() => item.enabled && navigate(item.path)}
            >
              <span className="nav-item-main">
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
              </span>
              {!item.enabled && <small>Soon</small>}
              {item.label === "Projects" && projectInvitations.length > 0 && (
                <small aria-label={`${projectInvitations.length} pending invitations`}>
                  {projectInvitations.length}
                </small>
              )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-avatar" aria-hidden="true">
            {(settings.profile.displayName || user.email)?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="sidebar-account-copy">
            <strong>{settings.profile.displayName || user.email}</strong>
            <span>Signed in</span>
          </div>
          <button
            className="sidebar-logout"
            type="button"
            onClick={handleSignOut}
            disabled={signOutState.pending}
            aria-busy={signOutState.pending}
            aria-describedby={
              signOutState.error ? "sidebar-signout-error" : undefined
            }
          >
            {signOutState.pending ? "Signing out..." : "Log out"}
          </button>
          {signOutState.error && (
            <p
              className="signout-error sidebar-signout-error"
              id="sidebar-signout-error"
              role="alert"
            >
              {signOutState.error}
            </p>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>

          <NotificationsPanel userId={user.uid} onNavigate={navigate} />

          {currentView !== "settings" && currentView !== "archived" &&
            !(currentView === "project" && selectedProject?.viewerRole === "viewer") && (
            <div className="topbar-actions">
              <button
                ref={newTaskButtonRef}
                className="primary-btn"
                type="button"
                onClick={() =>
                  openTaskForm(
                    currentView === "project" && selectedProject
                      ? { projectId: selectedProject.id }
                      : {}
                  )
                }
                disabled={taskFormSaving}
                aria-haspopup="dialog"
                aria-expanded={showTaskForm}
                aria-controls="create-task-dialog"
              >
                + New Task
              </button>
            </div>
          )}
        </header>

        {showTaskForm && (
          <div
            className="task-modal-backdrop"
            onMouseDown={handleTaskModalBackdrop}
          >
            <section
              className="task-modal"
              id="create-task-dialog"
              role="dialog"
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
            lists={lists}
            listsLoading={listsLoading}
            listsError={listsError}
            onRetryLists={loadLists}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            formatSettings={settings.time}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
          />
        </div>

        <div className="route-content" hidden={currentView !== "today"}>
          <TodayPage
            tasks={activeTasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            onArchiveTask={handleArchiveTask}
            lists={lists}
            formatSettings={settings.time}
            myDaySettings={settings.myDay}
            projects={editableProjects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
          />
        </div>

        <div className="route-content" hidden={currentView !== "calendar"}>
          <CalendarPage
            tasks={activeTasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            onArchiveTask={handleArchiveTask}
            onCreateTask={(schedule) =>
              openTaskForm(
                typeof schedule === "string"
                  ? { dueDate: schedule }
                  : schedule
              )
            }
            formatSettings={settings.time}
            weekStartsOn={weekStartIndex(settings.time.weekStartsOn)}
            lists={lists}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            browserNotificationsEnabled={
              settings.reminder.enableBrowserNotifications
            }
          />
        </div>

        <div className="route-content" hidden={currentView !== "projects"}>
          <ProjectsPage
            userId={user.uid}
            projects={editableProjects}
            loading={projectsLoading}
            error={projectsError}
            onRetry={loadProjects}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            createRequest={projectCreateRequest}
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
            weekStartsOn={weekStartIndex(settings.time.weekStartsOn)}
            refreshToken={projectTaskRefreshToken}
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
            onOpenInvitations={() => navigate("/projects")}
          />
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
            signOutPending={signOutState.pending}
            signOutError={signOutState.error}
            onNavigate={navigate}
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
            onBack={() => navigate("/settings")}
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
