import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./Dashboard";
import Login from "./Login";
import TaskForm from "./TaskForm";
import TasksPage from "./TasksPage";
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
  { label: "Dashboard", view: "dashboard", enabled: true },
  { label: "Today", enabled: false },
  { label: "Tasks", view: "tasks", enabled: true },
  { label: "Projects", enabled: false },
  { label: "Calendar", enabled: false },
  { label: "Reminders", enabled: false },
  { label: "Settings", enabled: false },
];

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
  const [activeView, setActiveView] = useState("dashboard");
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

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  const isTasksView = activeView === "tasks";

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
                item.view === activeView ? "active" : ""
              } ${item.enabled ? "" : "nav-item-disabled"}`}
              disabled={!item.enabled}
              aria-current={
                item.view === activeView ? "page" : undefined
              }
              aria-label={item.enabled ? item.label : `${item.label}, coming soon`}
              onClick={() => item.enabled && setActiveView(item.view)}
            >
              <span>{item.label}</span>
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
            <h1>{isTasksView ? "Tasks" : "Dashboard"}</h1>
            <p>
              {isTasksView
                ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
                : "A clear view of what needs your attention."}
            </p>
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

        {isTasksView ? (
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
        ) : (
          <Dashboard
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
          />
        )}
      </main>
    </div>
  );
}

export default App;
