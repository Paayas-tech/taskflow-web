/**
 * Test helpers: seed the store with an in-memory api and render a component
 * against it. No providers, no mocks — components read the real store.
 *
 *   const { api, user } = await seedStore({ tasks: [makeTask()] });
 *   renderPage(<MyTasksPage />);
 */
import { render } from "@testing-library/react";
import { startSession } from "../store/session";
import { configureStore } from "../store/store";
import { createFakeApi, makeUser } from "./fakeApi";

/** Configures the store with a fake api and signs `user` in. */
export const seedStore = async ({ user: userSeed, ...seed } = {}) => {
  const user = makeUser(userSeed || {});
  const api = createFakeApi({ user, ...seed });
  configureStore({ api });
  await startSession(user);
  return { api, user };
};

export const renderPage = (ui, options) => render(ui, options);
