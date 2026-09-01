import { useEffect, useMemo, useRef, useState } from "react";

const icon = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    {paths}
  </svg>
);

export default function GlobalTopNav({
  sidebarCollapsed,
  onToggleSidebar,
  searchItems = [],
  onOpenSearchItem,
  createActions = [],
  notificationControl,
  displayName,
  email,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  signOutPending = false,
}) {
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState("");
  const [helpTopic, setHelpTopic] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return searchItems.filter((item) =>
      [item.title, item.subtitle, item.type].some((value) =>
        String(value || "").toLocaleLowerCase().includes(normalized)
      )
    ).slice(0, 8);
  }, [query, searchItems]);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenMenu("");
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenu("");
        setHelpTopic("");
      }
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleMenu = (menu) => {
    setHelpTopic("");
    setOpenMenu((current) => current === menu ? "" : menu);
  };

  const openResult = (item) => {
    setQuery("");
    setOpenMenu("");
    onOpenSearchItem?.(item);
  };

  const initial = String(displayName || email || "U").trim()[0]?.toUpperCase() || "U";

  return (
    <header ref={rootRef} className="global-top-nav">
      <div className="global-nav-brand-group">
        <button className="global-nav-icon-button" type="button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {icon(<><path d="M4 6h16M4 12h16M4 18h16" /></>)}
        </button>
        <button className="global-nav-brand" type="button" onClick={() => onOpenSearchItem?.({ type: "home" })} aria-label="Open TaskFlow dashboard">
          <span className="brand-mark" aria-hidden="true" />
          <strong>TaskFlow</strong>
        </button>
      </div>

      <div className="global-search">
        <span className="global-search-icon" aria-hidden="true">{icon(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>)}</span>
        <input ref={searchRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setOpenMenu("search"); }} onFocus={() => query.trim() && setOpenMenu("search")} placeholder="Search" aria-label="Search TaskFlow" aria-expanded={openMenu === "search"} aria-controls="global-search-results" autoComplete="off" />
        {query && <button type="button" onClick={() => { setQuery(""); setOpenMenu(""); }} aria-label="Clear search">×</button>}
        {openMenu === "search" && query.trim() && (
          <section id="global-search-results" className="global-nav-popover global-search-results" aria-label="Search results">
            {results.length > 0 ? results.map((item) => (
              <button key={`${item.type}-${item.id}`} type="button" onClick={() => openResult(item)}>
                <span className={`global-result-type global-result-${item.type}`}>{item.type === "story" ? "S" : item.type === "project" ? "P" : "T"}</span>
                <span><strong>{item.title}</strong><small>{item.subtitle || item.type}</small></span>
              </button>
            )) : <p>No accessible TaskFlow items match “{query.trim()}”.</p>}
          </section>
        )}
      </div>

      <div className="global-nav-actions">
        <div className="global-nav-menu-wrap">
          <button className="primary-btn global-create-button" type="button" onClick={() => toggleMenu("create")} aria-haspopup="menu" aria-expanded={openMenu === "create"}>+ Create</button>
          {openMenu === "create" && (
            <div className="global-nav-popover global-nav-menu" role="menu" aria-label="Create">
              {createActions.map((action) => <button key={action.label} type="button" role="menuitem" onClick={() => { setOpenMenu(""); action.onSelect(); }}><strong>{action.label}</strong><small>{action.description}</small></button>)}
            </div>
          )}
        </div>

        {notificationControl}

        <div className="global-nav-menu-wrap">
          <button className="global-nav-icon-button" type="button" onClick={() => toggleMenu("help")} aria-label="Help" title="Help" aria-haspopup="menu" aria-expanded={openMenu === "help"}>?</button>
          {openMenu === "help" && (
            <div className="global-nav-popover global-nav-menu global-help-menu" role="menu" aria-label="TaskFlow help">
              <button type="button" role="menuitem" onClick={() => setHelpTopic("shortcuts")}><strong>Keyboard shortcuts</strong><small>View useful navigation shortcuts</small></button>
              <button type="button" role="menuitem" onClick={() => setHelpTopic("about")}><strong>About TaskFlow</strong><small>Tasks, projects, Stories, and teamwork</small></button>
              {helpTopic === "shortcuts" && <p><kbd>/</kbd> Focus search · <kbd>Esc</kbd> Close menus</p>}
              {helpTopic === "about" && <p>TaskFlow keeps personal tasks and collaborative project work in one focused workspace.</p>}
            </div>
          )}
        </div>

        <div className="global-nav-menu-wrap">
          <button className="global-profile-button" type="button" onClick={() => toggleMenu("profile")} aria-label="Account menu" aria-haspopup="menu" aria-expanded={openMenu === "profile"}>{initial}</button>
          {openMenu === "profile" && (
            <div className="global-nav-popover global-profile-menu" role="menu" aria-label="Account">
              <div><span className="global-profile-large" aria-hidden="true">{initial}</span><span><strong>{displayName || "TaskFlow user"}</strong><small>{email}</small></span></div>
              <button type="button" role="menuitem" onClick={() => { setOpenMenu(""); onOpenProfile?.(); }}>Profile</button>
              <button type="button" role="menuitem" onClick={() => { setOpenMenu(""); onOpenSettings?.(); }}>Settings</button>
              <button type="button" role="menuitem" disabled={signOutPending} onClick={() => { setOpenMenu(""); onSignOut?.(); }}>{signOutPending ? "Signing out…" : "Sign out"}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
