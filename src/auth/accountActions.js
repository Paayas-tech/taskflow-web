/**
 * Account actions shared by the sidebar user menu and the settings page.
 * Neither ever throws: they resolve to "" on success or to the message the
 * caller should show. A failed sign-out keeps the session, so the person can
 * simply try again.
 */
import {
  deleteAccount as requestAccountDeletion,
  signOut as requestSignOut,
} from "../api/auth";
import { endSession } from "../store/session";
import { navigate } from "../store/ui";

const SIGN_OUT_ERROR =
  "Couldn’t sign out. Please check your connection and try again.";

const DELETE_ACCOUNT_ERROR =
  "We couldn't delete your account. Please try again.";

/** Signs out; the auth listener in `main.jsx` ends the store session. */
export const signOutAccount = async () => {
  try {
    await requestSignOut();
    return "";
  } catch {
    return SIGN_OUT_ERROR;
  }
};

/** Deletes the account, drops the session and returns to the home route. */
export const deleteAccountAndSignOut = async () => {
  try {
    await requestAccountDeletion();
    endSession();
    navigate("/");
    return "";
  } catch {
    return DELETE_ACCOUNT_ERROR;
  }
};
