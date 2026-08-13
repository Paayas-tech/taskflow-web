import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import CalendarPage from "./CalendarPage";
import Dashboard from "./Dashboard";
import Login from "./Login";
import ProjectsPage from "./ProjectsPage";
import ProjectTasksPage from "./ProjectTasksPage";
import TaskForm from "./TaskForm";
import TasksPage from "./TasksPage";
import TodayPage from "./TodayPage";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "./services/taskService";
import {
  getLists,
  createList,
  updateList,
  deleteList,
} from "./services/listService";
import {
  createProject,
  getProjects,
} from "./services/projectService";

const navItems = [
  { label: "Dashboard", path: "/", enabled: true, icon: "dashboard" },
  { label: "Today", path: "/today", enabled: true, icon: "today" },
  { label: "Tasks", path: "/tasks", enabled: true, icon: "tasks" },
  { label: "Projects", path: "/projects", enabled: true, icon: "projects" },
  { label: "Calendar", path: "/calendar", enabled: true, icon: "calendar" },
  { label: "Reminders", enabled: false, icon: "reminders" },
  { label: "Settings", enabled: false, icon: "settings" },
];

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

const routeViews = {
  "/": "dashboard",
  "/today": "today",
  "/tasks": "tasks",
  "/projects": "projects",
  "/calendar": "calendar",
};

const projectIdFromPath = (pathname) => {
  if (!pathname.startsWith("/projects/")) return null;

  const encodedProjectId = pathname.slice("/projects/".length);
  if (!encodedProjectId || encodedProjectId.includes("/")) return null;

  try {
    const projectId = decodeURIComponent(encodedProjectId);
    return projectId && !projectId.includes("/") ? projectId : null;
  } catch {
    return null;
  }
};

const normalizePath = (pathname) => {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (routeViews[withoutTrailingSlash]) return withoutTrailingSlash;

  const projectId = projectIdFromPath(withoutTrailingSlash);
  return projectId ? `/projects/${encodeURIComponent(projectId)}` : "/";
};

const emptyTaskForm = {
  title: "",
  description: "",
  notes: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  reminder: false,
  listId: "",
  projectId: "",
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(window.location.pathname)
  );
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState("");
  const [lists, setLists] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projects, setProjects] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormSaving, setTaskFormSaving] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [quickTaskPendingIds, setQuickTaskPendingIds] = useState(
    () => new Set()
  );
  const newTaskButtonRef = useRef(null);
  const taskFormSubmissionRef = useRef(false);
  const tasksRef = useRef([]);
  const quickTaskMutationsRef = useRef(new Map());

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

    setTasksLoading(true);
    setTasksError("");

    try {
      const userTasks = await getTasks(user.uid);
      const tasksWithPendingChanges = userTasks.map((task) => {
        const pendingMutation = quickTaskMutationsRef.current.get(task.id);

        return pendingMutation
          ? { ...task, ...pendingMutation.optimisticPatch }
          : task;
      });

      tasksRef.current = tasksWithPendingChanges;
      setTasks(tasksWithPendingChanges);
    } catch (error) {
      console.error("Error loading tasks:", error);
      tasksRef.current = [];
      setTasks([]);
      setTasksError(
        "We couldn't load your tasks. Check your connection and try again."
      );
    } finally {
      setTasksLoading(false);
    }
  }, [user]);

  const loadLists = useCallback(async () => {
    if (!user) return;

    setListsLoading(true);
    setListsError("");

    try {
      const userLists = await getLists(user.uid);
      setLists(userLists);
    } catch (error) {
      console.error("Error loading lists:", error);
      setLists([]);
      setListsError(
        "We couldn't load your lists. Check your connection and try again."
      );
    } finally {
      setListsLoading(false);
    }
  }, [user]);

  const loadProjects = useCallback(async () => {
    if (!user) return;

    setProjectsLoading(true);
    setProjectsError("");

    try {
      const userProjects = await getProjects(user.uid);
      setProjects(userProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
      setProjects([]);
      setProjectsError(
        "We couldn't load your projects. Check your connection and try again."
      );
    } finally {
      setProjectsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

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
    }
  }, [user, loadTasks, loadLists, loadProjects]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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
      await createTask(user.uid, {
        title: taskForm.title,
        description: taskForm.description,
        notes: taskForm.notes,
        status: taskForm.status,
        completed: taskForm.status === "completed",
        priority: taskForm.priority,
        dueDate: taskForm.dueDate,
        reminder: taskForm.reminder,
        listId: taskForm.listId || null,
        projectId: taskForm.projectId || null,
      });

      setTaskForm(emptyTaskForm);
      setShowTaskForm(false);
      await loadTasks();
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

  const openTaskForm = (initialValues = {}) => {
    setTaskFormError("");
    setTaskForm({ ...emptyTaskForm, ...initialValues });
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
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTaskForm, showTaskForm, taskFormSaving]);

  const navigate = (path) => {
    if (path === currentPath) return;

    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  const selectedProjectId = projectIdFromPath(currentPath);
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );
  const currentView = selectedProjectId
    ? "project"
    : routeViews[currentPath];
  const selectedProjectTaskCount = selectedProject
    ? tasks.filter((task) => task.projectId === selectedProject.id).length
    : 0;
  const pageTitle =
    currentView === "tasks"
      ? "Tasks"
      : currentView === "today"
        ? "Today"
        : currentView === "calendar"
          ? "Calendar"
        : currentView === "projects"
          ? "Projects"
          : currentView === "project"
            ? selectedProject?.name || "Project"
        : "Dashboard";
  const pageSubtitle =
    currentView === "tasks"
      ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
      : currentView === "today"
        ? "Overdue and due-today tasks in one focused view."
        : currentView === "calendar"
          ? "Plan dated work from your existing TaskFlow tasks."
        : currentView === "projects"
          ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
          : currentView === "project"
            ? selectedProject
              ? `${selectedProjectTaskCount} ${selectedProjectTaskCount === 1 ? "task" : "tasks"} in this project`
              : projectsLoading
                ? "Loading project..."
                : "Project unavailable"
        : "A clear view of what needs your attention.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand">TaskFlow</div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive =
              item.path === currentPath ||
              (item.path === "/projects" && currentView === "project");

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
              </button>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-avatar" aria-hidden="true">
            {user.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="sidebar-account-copy">
            <strong>{user.email}</strong>
            <span>Signed in</span>
          </div>
          <button
            className="sidebar-logout"
            type="button"
            onClick={() => signOut(auth)}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>

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
                projects={projects}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
                onRetryProjects={loadProjects}
              />
            </section>
          </div>
        )}

        <div className="route-content" hidden={currentView !== "tasks"}>
          <TasksPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            lists={lists}
            listsLoading={listsLoading}
            listsError={listsError}
            onRetryLists={loadLists}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
          />
        </div>

        <div className="route-content" hidden={currentView !== "today"}>
          <TodayPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            lists={lists}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
          />
        </div>

        <div className="route-content" hidden={currentView !== "calendar"}>
          <CalendarPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            onCreateTask={(dueDate) => openTaskForm({ dueDate })}
            lists={lists}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
          />
        </div>

        <div className="route-content" hidden={currentView !== "projects"}>
          <ProjectsPage
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            onRetry={loadProjects}
            onCreateProject={handleCreateProject}
            onOpenProject={(projectId) =>
              navigate(`/projects/${encodeURIComponent(projectId)}`)
            }
          />
        </div>

        {currentView === "project" && (
          <ProjectTasksPage
            projectId={selectedProjectId}
            project={selectedProject}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={loadProjects}
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetryTasks={loadTasks}
            onUpdateTask={handleUpdateTask}
            onQuickUpdateTask={handleQuickUpdateTask}
            quickTaskPendingIds={quickTaskPendingIds}
            onDeleteTask={handleDeleteTask}
            lists={lists}
            onBack={() => navigate("/projects")}
            onCreateTask={() =>
              openTaskForm({ projectId: selectedProject.id })
            }
          />
        )}

        <div className="route-content" hidden={currentView !== "dashboard"}>
          <Dashboard
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
