import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./Dashboard";
import Login from "./Login";
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

const navItems = [
  { label: "Dashboard", path: "/", enabled: true, icon: "dashboard" },
  { label: "Today", path: "/today", enabled: true, icon: "today" },
  { label: "Tasks", path: "/tasks", enabled: true, icon: "tasks" },
  { label: "Projects", enabled: false, icon: "projects" },
  { label: "Calendar", enabled: false, icon: "calendar" },
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
};

const normalizePath = (pathname) => {
  const withoutTrailingSlash =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return routeViews[withoutTrailingSlash] ? withoutTrailingSlash : "/";
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
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormSaving, setTaskFormSaving] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);

  const loadTasks = useCallback(async () => {
    if (!user) return;

    setTasksLoading(true);
    setTasksError("");

    try {
      const userTasks = await getTasks(user.uid);
      setTasks(userTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
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
    }
  }, [user, loadTasks, loadLists]);

  const handleTaskChange = (event) => {
    const { name, value, type, checked } = event.target;

    setTaskForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setTaskFormError("");

    if (!taskForm.title.trim()) {
      setTaskFormError("Enter a task title before saving.");
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

  const openTaskForm = () => {
    setTaskFormError("");
    setShowTaskForm(true);
  };

  const closeTaskForm = () => {
    setTaskFormError("");
    setShowTaskForm(false);
  };

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

  const currentView = routeViews[currentPath];
  const pageTitle =
    currentView === "tasks"
      ? "Tasks"
      : currentView === "today"
        ? "Today"
        : "Dashboard";
  const pageSubtitle =
    currentView === "tasks"
      ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
      : currentView === "today"
        ? "Overdue and due-today tasks in one focused view."
        : "A clear view of what needs your attention.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand">TaskFlow</div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${
                item.path === currentPath ? "active" : ""
              } ${item.enabled ? "" : "nav-item-disabled"}`}
              disabled={!item.enabled}
              aria-current={
                item.path === currentPath ? "page" : undefined
              }
              aria-label={item.enabled ? item.label : `${item.label}, coming soon`}
              onClick={() => item.enabled && navigate(item.path)}
            >
              <span className="nav-item-main">
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
              </span>
              {!item.enabled && <small>Soon</small>}
            </button>
          ))}
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
            <button className="primary-btn" type="button" onClick={openTaskForm}>
              + New Task
            </button>
          </div>
        </header>

        {showTaskForm && (
          <section className="panel task-form-panel">
            <div className="panel-header">
              <h2>Create Task</h2>

              <button className="ghost-btn" type="button" onClick={closeTaskForm}>
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
            />
          </section>
        )}

        <div className="route-content" hidden={currentView !== "tasks"}>
          <TasksPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            lists={lists}
            listsLoading={listsLoading}
            listsError={listsError}
            onRetryLists={loadLists}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
          />
        </div>

        <div className="route-content" hidden={currentView !== "today"}>
          <TodayPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            lists={lists}
          />
        </div>

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
