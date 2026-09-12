import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "./api/client";
import { completeOnboarding } from "./api/auth";
import { signOutAccount } from "./auth/accountActions";
import { ConfigurationErrorScreen } from "./auth/ConfigurationErrorScreen";
import { Login } from "./auth/Login";
import { Onboarding } from "./auth/Onboarding";
import { Recover } from "./auth/Recover";
import { defaultViewPath, resolveThemeMode } from "./domain/settings";
import { ArchivedTasksPage } from "./pages/ArchivedTasksPage";
import { CalendarPage } from "./pages/CalendarPage";
import { HomePage } from "./pages/HomePage";
import { InboxPage } from "./pages/InboxPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectWorkspacePage } from "./pages/ProjectWorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  normalizePath,
  pageTitle,
  projectIdFromPath,
  routeViewFromPath,
} from "./router";
import { AppShell } from "./shell/AppShell";
import { AgentDrawer } from "./shell/AgentDrawer";
import { ProfileCompletionPrompt } from "./shell/ProfileCompletionPrompt";
import { SearchDialog } from "./shell/SearchDialog";
import { Sidebar } from "./shell/Sidebar";
import { Toasts } from "./shell/Toasts";
import {
  selectAuth,
  selectLoaded,
  selectPath,
  selectProject,
  selectSettings,
  selectUi,
} from "./store/selectors";
import { handleAuthEvent } from "./store/session";
import { saveSettings } from "./store/settings";
import { useStore } from "./store/store";
import { navigate, setMobileNav, setSearchOpen } from "./store/ui";
import { TaskComposerDialog } from "./tasks/TaskComposerDialog";
import { TaskDetailPanel } from "./tasks/TaskDetailPanel";
import { Icon, IconButton } from "./ui";

const isTypingTarget = (target) =>
  Boolean(target) &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.isContentEditable === true);

const LoadingScreen = () => <div className="loading-screen">Loading...</div>;

/** The page for a route; every page reads what it renders from the store. */
function RoutePage({ view }) {
  if (view === "tasks") return <MyTasksPage />;
  if (view === "calendar") return <CalendarPage />;
  if (view === "inbox") return <InboxPage />;
  if (view === "projects") return <ProjectsPage />;
  if (view === "project") return <ProjectWorkspacePage />;
  if (view === "settings") return <SettingsPage />;
  if (view === "archived") return <ArchivedTasksPage />;
  return <HomePage />;
}

export function App() {
  const auth = useStore(selectAuth);
  const path = useStore(selectPath);
  const settings = useStore(selectSettings);
  const loaded = useStore(selectLoaded);
  const ui = useStore(selectUi);

  const [authEntryMode, setAuthEntryMode] = useState("signin");
  const [agentOpen, setAgentOpen] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const defaultRouteApplied = useRef(false);

  const view = routeViewFromPath(path);
  const projectId = projectIdFromPath(path);
  const selectedProject = useStore(selectProject(projectId));

  const themeMode = settings.theme.mode;
  const languageCode = settings.language.code;
  const settingsReady = loaded.settings === "ready" || loaded.settings === "error";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = resolveThemeMode(themeMode, mediaQuery.matches);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();
    if (themeMode !== "system") return undefined;

    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = languageCode;
  }, [languageCode]);

  useEffect(() => {
    document.title = `${pageTitle(view, selectedProject)} · TaskFlow`;
  }, [view, selectedProject]);

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

  // Once per session: open the view the account asked to start on.
  useEffect(() => {
    if (!auth.user) {
      defaultRouteApplied.current = false;
      return;
    }
    if (loaded.settings !== "ready" || defaultRouteApplied.current) return;

    defaultRouteApplied.current = true;
    if (normalizePath(window.location.pathname) !== "/") return;

    const startupPath = defaultViewPath(
      settings.navigation.defaultView,
      settings.navigation.lastViewedPath
    );
    if (startupPath !== "/") navigate(startupPath);
  }, [auth.user, loaded.settings, settings.navigation]);

  const handleSignInSuccess = () => {
    setAuthEntryMode("signin");
    defaultRouteApplied.current = true;
    navigate("/");
  };

  const handleOnboardingComplete = async ({ displayName, purpose }) => {
    setOnboardingSaving(true);
    try {
      const saved = await saveSettings({
        ...settings,
        profile: { ...settings.profile, displayName },
        data: { ...settings.data, onboardingPurpose: purpose },
      });
      // A failed save already restored the previous settings; an empty message
      // lets Onboarding show its own "couldn't finish setting up" wording.
      if (!saved) throw new Error();

      const user = await completeOnboarding();
      if (user) await handleAuthEvent("USER_UPDATED", user);

      navigate(
        defaultViewPath(
          saved.settings.navigation.defaultView,
          saved.settings.navigation.lastViewedPath
        )
      );
    } finally {
      setOnboardingSaving(false);
    }
  };

  const handleStartOver = async () => {
    setAuthEntryMode("signup");
    const error = await signOutAccount();
    if (error) {
      // The account is still signed in. Do not leave a latent sign-up mode
      // behind for a later, unrelated sign-out.
      setAuthEntryMode("signin");
      throw new Error(error);
    }
  };

  if (!isSupabaseConfigured) {
    return <ConfigurationErrorScreen onRetry={() => window.location.reload()} />;
  }

  if (auth.status === "booting") return <LoadingScreen />;

  if (path === "/recover") {
    return (
      <Recover
        recoverySession={auth.recovery}
        onBack={() => navigate("/")}
        onComplete={() => {
          defaultRouteApplied.current = true;
          navigate("/");
        }}
      />
    );
  }

  if (!auth.user) {
    return (
      <Login
        initialMode={authEntryMode}
        onSignInSuccess={handleSignInSuccess}
        onRecoverPassword={() => navigate("/recover")}
      />
    );
  }

  if (auth.user.onboardingRequired) {
    if (!settingsReady) return <LoadingScreen />;
    return (
      <Onboarding
        displayName={settings.profile.displayName || auth.user.displayName}
        saving={onboardingSaving}
        onComplete={handleOnboardingComplete}
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <>
      <AppShell sidebar={<Sidebar />}>
        <IconButton
          className="menu-toggle app-menu-toggle"
          label="Open navigation"
          onClick={() => setMobileNav(true)}
        >
          <Icon name="list" />
        </IconButton>
        <ProfileCompletionPrompt />
        <RoutePage view={view} />
      </AppShell>

      <TaskDetailPanel taskId={ui.selectedTaskId} />
      <TaskComposerDialog />
      <SearchDialog />

      <IconButton className="agent-fab" label="Open TaskFlow Agent" onClick={() => setAgentOpen(true)}>
        <Icon name="sparkles" size={18} />
      </IconButton>
      <AgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} project={selectedProject} />

      <Toasts />
    </>
  );
}
