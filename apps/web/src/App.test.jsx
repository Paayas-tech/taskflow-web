import userEvent from "@testing-library/user-event";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SPLASH_SESSION_KEY } from "./components/WelcomeSplash";
import { completeOnboarding, signOut } from "./api/auth";
import { createFakeApi, makeUser } from "./test/fakeApi";
import { renderPage, seedStore } from "./test/renderApp";
import { endSession, startSession } from "./store/session";
import { configureStore, getState } from "./store/store";
import { navigate, notify } from "./store/ui";

vi.mock("./api/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  verifySignupOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
  completeOnboarding: vi.fn(),
}));

// The suite runs entirely against the in-memory fake api, so no test may depend
// on the machine's `.env`: the client module is stubbed, and `configured` flips
// the one branch App reads from it.
const client = vi.hoisted(() => ({ configured: true }));
vi.mock("./api/client", () => ({
  get isSupabaseConfigured() {
    return client.configured;
  },
  supabase: null,
  requireSupabase: () => {
    throw new Error("Tests never reach Supabase.");
  },
  throwIfError: () => {},
  currentUserId: async () => null,
  subscribeToTable: () => () => {},
}));

/** Signs the seeded account out again, leaving the store configured. */
const signedOut = async ({ splashSeen = true } = {}) => {
  await seedStore();
  endSession();
  if (splashSeen) window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
  else window.sessionStorage.removeItem(SPLASH_SESSION_KEY);
};

/** A first-run account: signed in, still behind the onboarding gate. */
const seedNewAccount = () => seedStore({ user: { onboardingRequired: true } });

afterEach(() => {
  client.configured = true;
  completeOnboarding.mockReset();
  signOut.mockReset();
  window.sessionStorage.removeItem(SPLASH_SESSION_KEY);
  window.history.replaceState({}, "", "/");
});

describe("App auth gate", () => {
  it("shows the welcome splash once for a signed-out browsing session", async () => {
    await signedOut({ splashSeen: false });
    renderPage(<App />);

    expect(screen.getByRole("region", { name: "Welcome to TaskFlow" })).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("shows the sign-in screen when nobody is signed in", async () => {
    await signedOut();
    renderPage(<App />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
  });

  it("shows password recovery on /recover", async () => {
    await signedOut();
    navigate("/recover");
    renderPage(<App />);

    expect(screen.getByText("Reset your password")).toBeInTheDocument();
  });

  it("renders the shell and the route's page once signed in", async () => {
    await seedStore();
    renderPage(<App />);

    expect(screen.getByRole("complementary", { name: "Sidebar" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening)/ })
    ).toBeInTheDocument();
    expect(document.title).toBe("Home · TaskFlow");
  });

  it("asks for configuration when Supabase credentials are missing", async () => {
    client.configured = false;
    await seedStore();
    renderPage(<App />);

    expect(
      screen.getByRole("alert", { name: "Configuration required" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("TaskFlow setup is incomplete. Contact your administrator.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
  });
});

describe("App onboarding gate", () => {
  it("holds a brand-new account on the onboarding screen", async () => {
    await seedNewAccount();
    renderPage(<App />);

    expect(screen.getByText(/make TaskFlow yours/)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
  });

  it("waits for the saved settings before asking for a name", async () => {
    const account = makeUser({ onboardingRequired: true });
    configureStore({ api: createFakeApi({ user: account }) });
    const session = startSession(account);
    renderPage(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await act(async () => {
      await session;
    });

    expect(screen.getByText(/make TaskFlow yours/)).toBeInTheDocument();
  });

  it("saves the name and purpose, completes onboarding and opens the app", async () => {
    const user = userEvent.setup();
    const { api, user: account } = await seedNewAccount();
    completeOnboarding.mockResolvedValue({ ...account, onboardingRequired: false });
    renderPage(<App />);

    const nameField = screen.getByLabelText("Display name");
    await user.clear(nameField);
    await user.type(nameField, "Alex Chen");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("radio", { name: /Personal/ }));
    await user.click(screen.getByRole("button", { name: "Enter TaskFlow" }));

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));

    const [, saved] = api.callsOf("saveSettings")[0];
    expect(saved.profile.displayName).toBe("Alex Chen");
    expect(saved.data.onboardingPurpose).toBe("personal");
    expect(getState().auth.user.onboardingRequired).toBe(false);
    expect(getState().ui.path).toBe("/");
    expect(
      await screen.findByRole("complementary", { name: "Sidebar" })
    ).toBeInTheDocument();
  });

  it("keeps the account on the onboarding screen when the save fails", async () => {
    const user = userEvent.setup();
    const { api } = await seedNewAccount();
    api.failNext("saveSettings", new Error("Network request failed."));
    renderPage(<App />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Enter TaskFlow" }));

    expect(
      await screen.findByText(
        "We couldn't finish setting up your workspace. Please try again."
      )
    ).toBeInTheDocument();
    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
  });

  it("does not leave a failed restart on the sign-up tab after a later sign-out", async () => {
    const user = userEvent.setup();
    signOut.mockRejectedValueOnce(new Error("offline"));
    await seedNewAccount();
    renderPage(<App />);

    await user.click(
      screen.getByRole("button", { name: "Go back and start signup over" })
    );
    expect(
      await screen.findByText("Couldn’t sign out. Please check your connection and try again.")
    ).toBeInTheDocument();

    act(() => endSession());

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in", pressed: true })
    ).toBeInTheDocument();
  });
});

describe("App shell", () => {
  it("opens search with ⌘K", async () => {
    await seedStore();
    renderPage(<App />);

    expect(screen.queryByLabelText("Search projects and tasks")).toBeNull();

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(getState().ui.searchOpen).toBe(true);
    expect(screen.getByLabelText("Search projects and tasks")).toBeInTheDocument();
  });

  it("shows a notice and dismisses it", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<App />);

    notify({ tone: "error", text: "We couldn't save that." });

    const toast = await screen.findByRole("alert");
    expect(toast).toHaveTextContent("We couldn't save that.");

    await user.click(screen.getByRole("button", { name: "Dismiss message" }));

    expect(getState().ui.notice).toBeNull();
    expect(screen.queryByText("We couldn't save that.")).toBeNull();
  });

  it("navigates between views from the sidebar", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<App />);

    await user.click(screen.getByRole("button", { name: "Calendar" }));

    expect(getState().ui.path).toBe("/calendar");
    expect(document.title).toBe("Calendar · TaskFlow");
  });

  it("opens the create dialog for 'New project' from another page", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<App />);

    const sidebar = within(screen.getByRole("complementary", { name: "Sidebar" }));
    await user.click(sidebar.getByRole("button", { name: "New project" }));

    expect(getState().ui.path).toBe("/projects");
    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });
});
