export const SAFE_SIGN_OUT_ERROR =
  "Couldn’t sign out. Please check your connection and try again.";

export const createSignOutController = ({ performSignOut, onStateChange }) => {
  let state = { pending: false, error: "" };

  const publish = () => onStateChange?.({ ...state });

  return {
    getState: () => ({ ...state }),

    reset() {
      state = { pending: false, error: "" };
      publish();
    },

    async run() {
      if (state.pending) {
        return { ok: false, duplicate: true };
      }

      state = { pending: true, error: "" };
      publish();

      try {
        await performSignOut();
        state = { pending: false, error: "" };
        publish();
        return { ok: true };
      } catch {
        state = { pending: false, error: SAFE_SIGN_OUT_ERROR };
        publish();
        return { ok: false, error: SAFE_SIGN_OUT_ERROR };
      }
    },
  };
};
