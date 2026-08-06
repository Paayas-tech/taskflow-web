import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./Dashboard";
import Login from "./Login";
import TasksPage from "./TasksPage";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getTasks, createTask } from "./services/taskService";

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
  status: "todo",
  dueDate: "",
  reminder: false,
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
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
    }
  }, [user, loadTasks]);

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

    try {
      await createTask(user.uid, {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        dueDate: taskForm.dueDate,
        reminder: taskForm.reminder,
      });

      setTaskForm(emptyTaskForm);
      setShowTaskForm(false);
      await loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      setTaskFormError(
        "We couldn't create this task. Check your connection and try again."
      );
    }
  };

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
        <div>
          <div className="brand">TaskFlow</div>
          <p className="brand-subtitle">
            Your productivity workspace
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${
                item.view === activeView ? "active" : ""
              }`}
              disabled={!item.enabled}
              aria-current={
                item.view === activeView ? "page" : undefined
              }
              onClick={() => item.enabled && setActiveView(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-title">Project status</p>
          <h3>Build phase 1</h3>
          <p>Dashboard and Tasks navigation foundation.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <p className="eyebrow">
              {isTasksView ? "Your workspace" : "Welcome back"}
            </p>
            <h1>{isTasksView ? "Tasks" : "Today"}</h1>
            <p className="topbar-date">
              {isTasksView
                ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
                : "Tuesday, August 4, 2026"}
            </p>
          </div>

          <div className="topbar-center">
            <input
              className="search"
              placeholder="Search tasks, boards, reminders..."
              disabled
              aria-label="Search is coming in a future phase"
            />
          </div>

          <div className="topbar-actions">
            <button className="primary-btn" onClick={openTaskForm}>
              + New Task
            </button>

            <button
              className="logout-btn"
              onClick={() => signOut(auth)}
            >
              Log out
            </button>
          </div>
        </header>

        {showTaskForm && (
          <section className="panel task-form-panel">
            <div className="panel-header">
              <h2>Create Task</h2>

              <button className="ghost-btn" onClick={closeTaskForm}>
                Close
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <input
                className="search"
                name="title"
                placeholder="Task title"
                value={taskForm.title}
                onChange={handleTaskChange}
              />

              <input
                className="search"
                name="description"
                placeholder="Description"
                value={taskForm.description}
                onChange={handleTaskChange}
              />

              <select
                name="status"
                value={taskForm.status}
                onChange={handleTaskChange}
              >
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
              </select>

              <input
                type="date"
                name="dueDate"
                value={taskForm.dueDate}
                onChange={handleTaskChange}
              />

              <label>
                <input
                  type="checkbox"
                  name="reminder"
                  checked={taskForm.reminder}
                  onChange={handleTaskChange}
                />
                Reminder
              </label>

              <button className="primary-btn" type="submit">
                Create Task
              </button>

              {taskFormError && (
                <p className="form-error" role="alert">
                  {taskFormError}
                </p>
              )}
            </form>
          </section>
        )}

        {isTasksView ? (
          <TasksPage
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
          />
        ) : (
          <Dashboard
            user={user}
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRetry={loadTasks}
            onSignOut={() => signOut(auth)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
