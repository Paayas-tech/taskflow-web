import { selectUi } from "../store/selectors";
import { useStore } from "../store/store";
import { clearNotice, setReminderNotice } from "../store/ui";
import { Icon, IconButton, cx } from "../ui";

/**
 * The two transient messages the app can show: the result of a mutation
 * (`ui.notice`, self-clearing after six seconds) and a task reminder that came
 * due while TaskFlow is open. Both can be up at once, so they stack.
 */
export function Toasts() {
  const { notice, reminderNotice } = useStore(selectUi);

  if (!notice && !reminderNotice) {
    return null;
  }

  const noticeIsError = notice?.tone === "error";

  return (
    <div className="toast-stack">
      {notice ? (
        <aside
          className={cx("toast", `toast-${notice.tone}`)}
          role={noticeIsError ? "alert" : "status"}
          aria-live={noticeIsError ? "assertive" : "polite"}
        >
          <div className="toast-body">
            <p className="toast-text">{notice.text}</p>
          </div>
          <IconButton label="Dismiss message" size="sm" onClick={clearNotice}>
            <Icon name="x" />
          </IconButton>
        </aside>
      ) : null}

      {reminderNotice ? (
        <aside className="toast" role="status" aria-live="assertive">
          <div className="toast-body">
            <strong className="toast-title">Task reminder</strong>
            <p className="toast-text">{reminderNotice.title}</p>
          </div>
          <IconButton
            label="Dismiss reminder"
            size="sm"
            onClick={() => setReminderNotice(null)}
          >
            <Icon name="x" />
          </IconButton>
        </aside>
      ) : null}
    </div>
  );
}
