import React from 'react';
import './App.css';

const navItems = ['Today', 'Tasks', 'Projects', 'Calendar', 'Reminders', 'Settings'];

const todayTasks = [
  { title: 'Plan project structure', time: '09:00 AM', status: 'In progress' },
  { title: 'Create dashboard UI', time: '11:00 AM', status: 'Pending' },
  { title: 'Review Firebase setup', time: '03:00 PM', status: 'Pending' },
];

const boardColumns = [
  {
    name: 'To do',
    count: 4,
    items: ['Add auth screen', 'Build task card', 'Create calendar panel'],
  },
  {
    name: 'In progress',
    count: 2,
    items: ['Design sidebar', 'Set up app layout'],
  },
  {
    name: 'Completed',
    count: 3,
    items: ['Create React app', 'Initialize Git', 'Fix PowerShell issue'],
  },
];

const calendarEvents = [
  { day: 'Mon', label: 'Team planning' },
  { day: 'Tue', label: 'UI build' },
  { day: 'Wed', label: 'Firebase review' },
  { day: 'Thu', label: 'Reminder logic' },
  { day: 'Fri', label: 'Testing' },
];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">TaskFlow</div>
          <p className="brand-subtitle">Your productivity workspace</p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item} className="nav-item">
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-title">Project status</p>
          <h3>Build phase 1</h3>
          <p>UI shell, task flow, calendar, and reminders.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Today</h1>
          </div>
          <div className="topbar-actions">
            <input className="search" placeholder="Search tasks, boards, reminders..." />
            <button className="primary-btn">+ New Task</button>
          </div>
        </header>

        <section className="hero-grid">
          <article className="hero-card accent">
            <p className="card-label">Focus</p>
            <h2>Build the first version of your task app UI</h2>
            <p>Keep the structure flexible so Firebase, collaboration, and AI agents can be added later.</p>
          </article>

          <article className="hero-card">
            <p className="card-label">Reminders</p>
            <h3>3 due today</h3>
            <p>Task reminders and push notifications will live here later.</p>
          </article>

          <article className="hero-card">
            <p className="card-label">Calendar</p>
            <h3>Weekly view</h3>
            <p>Tasks and events will share one calendar layer.</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel panel-wide">
            <div className="panel-header">
              <h2>To-do list</h2>
              <button className="ghost-btn">View all</button>
            </div>
            <div className="task-list">
              {todayTasks.map((task) => (
                <div key={task.title} className="task-row">
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.time}</p>
                  </div>
                  <span className={`status ${task.status === 'In progress' ? 'active' : ''}`}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel panel-wide">
            <div className="panel-header">
              <h2>Project board</h2>
              <button className="ghost-btn">Open board</button>
            </div>
            <div className="board-columns">
              {boardColumns.map((column) => (
                <div key={column.name} className="board-column">
                  <div className="column-head">
                    <h3>{column.name}</h3>
                    <span>{column.count}</span>
                  </div>
                  {column.items.map((item) => (
                    <div key={item} className="board-item">
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid bottom-grid">
          <article className="panel">
            <div className="panel-header">
              <h2>Calendar</h2>
              <button className="ghost-btn">Monthly</button>
            </div>
            <div className="calendar-list">
              {calendarEvents.map((event) => (
                <div key={event.day} className="calendar-item">
                  <span className="calendar-day-label">{event.day}</span>
                  <strong className="calendar-day-title">{event.label}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h2>Account</h2>
              <button className="ghost-btn">Sign in</button>
            </div>
            <div className="account-card">
              <div className="avatar">IN</div>
              <div>
                <h3>Guest user</h3>
                <p>Firebase authentication will connect here later.</p>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;