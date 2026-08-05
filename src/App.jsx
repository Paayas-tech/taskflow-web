import React, { useEffect, useState } from "react";
import "./App.css";
import Login from "./Login";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getTasks, createTask } from "./services/taskService";

const navItems = [
  "Dashboard",
  "Today",
  "Tasks",
  "Projects",
  "Calendar",
  "Reminders",
  "Settings",
];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasks, setTasks] = useState([]);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    dueDate: "",
    reminder: false,
  });

  const loadTasks = async () => {
    if (!user) return;

    setTasksLoading(true);

    try {
      const userTasks = await getTasks(user.uid);
      setTasks(userTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

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
  }, [user]);

  const handleTaskChange = (e) => {
    const { name, value, type, checked } = e.target;

    setTaskForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (!taskForm.title.trim()) return;

    try {
      await createTask(user.uid, {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        dueDate: taskForm.dueDate,
        reminder: taskForm.reminder,
      });

      setTaskForm({
        title: "",
        description: "",
        status: "todo",
        dueDate: "",
        reminder: false,
      });

      setShowTaskForm(false);

      await loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const todayTasks = tasks.slice(0, 3).map((task, index) => ({
    ...task,
    time: task.dueDate || "No due date",
    status: task.status || "Pending",
    _key: task.id || task.title || `task-${index}`,
  }));

  const boardColumns = [
    {
      name: "To do",
      status: "todo",
      items: tasks.filter(
        (task) =>
          task.status === "todo" ||
          task.status === "Todo" ||
          !task.status
      ),
    },
    {
      name: "In progress",
      status: "in-progress",
      items: tasks.filter(
        (task) =>
          task.status === "in-progress" ||
          task.status === "In Progress"
      ),
    },
    {
      name: "Completed",
      status: "completed",
      items: tasks.filter(
        (task) =>
          task.status === "completed" ||
          task.completed
      ),
    },
  ];

  const calendarEvents = tasks
    .filter((task) => task.dueDate)
    .map((task, index) => ({
      day: task.dueDate,
      label: task.title,
      _key: task.id || `${task.title}-${task.dueDate}-${index}`,
    }));

  const reminders = tasks
    .filter((task) => task.reminder)
    .map((task, index) => ({
      title: task.title,
      meta: task.dueDate
        ? `Due ${task.dueDate}`
        : "Reminder set",
      _key: task.id || `${task.title}-${task.dueDate || "reminder"}-${index}`,
    }));

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">TaskFlow</div>
          <p className="brand-subtitle">
            Your productivity workspace
          </p>
        </div>

        <nav className="nav-list">
          {navItems.map((item, idx) => (
            <button
              key={item}
              className={`nav-item ${idx === 0 ? "active" : ""}`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-title">
            Project status
          </p>
          <h3>Build phase 1</h3>
          <p>
            UI shell, task flow, calendar, and reminders.
          </p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <p className="eyebrow">Welcome back</p>
            <h1>Today</h1>
            <p className="topbar-date">
              Tuesday, August 4, 2026
            </p>
          </div>

          <div className="topbar-center">
            <input
              className="search"
              placeholder="Search tasks, boards, reminders..."
            />
          </div>

          <div className="topbar-actions">
            <button
              className="primary-btn"
              onClick={() => setShowTaskForm(true)}
            >
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
          <section className="panel">
            <div className="panel-header">
              <h2>Create Task</h2>

              <button
                className="ghost-btn"
                onClick={() => setShowTaskForm(false)}
              >
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
            </form>
          </section>
        )}

        <section className="hero-grid">
          <article className="hero-card accent">
            <p className="card-label">Focus</p>
            <h2>Build the first version of your task app UI</h2>
            <p>
              Keep the structure flexible so Firebase, collaboration, and AI agents can be added later.
            </p>
          </article>

          <article className="hero-card">
            <p className="card-label">Reminders</p>
            <h3>{reminders.length} due today</h3>
            <p>Task reminders are connected with Firestore.</p>
          </article>

          <article className="hero-card">
            <p className="card-label">Calendar</p>
            <h3>Weekly view</h3>
            <p>Tasks with due dates appear here.</p>
          </article>
        </section>

        <section className="content-grid task-board-grid">
          <article className="panel panel-wide todo-panel">
            <div className="panel-header">
              <h2>To-do list</h2>
              <button className="ghost-btn">View all</button>
            </div>

            <div className="task-list">
              {tasksLoading ? (
                <p>Loading tasks...</p>
              ) : todayTasks.length === 0 ? (
                <p>No tasks created yet.</p>
              ) : (
                todayTasks.map((task) => (
                  <div key={task._key} className="task-row">
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.time}</p>
                    </div>

                    <span
                      className={`status ${
                        task.status === "in-progress"
                          ? "active"
                          : ""
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel panel-wide board-panel">
            <div className="panel-header">
              <h2>Project board</h2>
              <button className="ghost-btn">Open board</button>
            </div>

            <div className="board-columns">
              {boardColumns.map((column) => (
                <div key={column.name} className="board-column">
                  <div className="column-head">
                    <h3>{column.name}</h3>
                    <span>{column.items.length}</span>
                  </div>

                  {column.items.length === 0 ? (
                    <div className="board-item">No tasks</div>
                  ) : (
                    column.items.map((task, index) => (
                      <div
                        key={
                          task.id ||
                          task.title ||
                          `${column.name}-${index}`
                        }
                        className="board-item"
                      >
                        {task.title}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid bottom-grid">
          <article className="panel">
            <div className="panel-header">
              <h2>Calendar</h2>
              <button className="ghost-btn">
                Monthly
              </button>
            </div>

            <div className="calendar-list">
              {calendarEvents.length === 0 ? (
                <p>No scheduled tasks.</p>
              ) : (
                calendarEvents.map((event) => (
                  <div
                    key={event._key}
                    className="calendar-item"
                  >
                    <span className="calendar-day-label">
                      {event.day}
                    </span>

                    <strong className="calendar-day-title">
                      {event.label}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h2>Account</h2>

              <button
                className="ghost-btn"
                onClick={() => signOut(auth)}
              >
                Sign out
              </button>
            </div>

            <div className="account-card">
              <div className="avatar">
                {user.email?.[0]?.toUpperCase() || "U"}
              </div>

              <div>
                <h3>{user.email}</h3>
                <p>
                  Firebase authentication is connected.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="reminders-section">
          <article className="panel">
            <div className="panel-header">
              <h2>Reminders</h2>

              <button className="ghost-btn">
                Manage
              </button>
            </div>

            <div className="reminder-grid">
              {reminders.length === 0 ? (
                <p>No reminders available.</p>
              ) : (
                reminders.map((reminder) => (
                  <div
                    key={reminder._key}
                    className="reminder-card"
                  >
                    <p>{reminder.title}</p>
                    <span>{reminder.meta}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <footer className="dashboard-footer">
          © 2026 TaskFlow. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

export default App;