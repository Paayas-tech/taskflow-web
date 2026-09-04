import { Button, Icon } from "../ui";

const CONFIGURATION_ERROR_MESSAGE =
  "TaskFlow setup is incomplete. Contact your administrator.";

export function ConfigurationErrorScreen({ onRetry }) {
  return (
    <main className="auth-page">
      <section
        className="auth-card auth-card-centered"
        role="alert"
        aria-labelledby="configuration-error-title"
      >
        <span className="auth-card-icon" aria-hidden="true">
          <Icon name="alert-circle" size={20} />
        </span>
        <h1 className="auth-title" id="configuration-error-title">
          Configuration required
        </h1>
        <p className="auth-subtitle">{CONFIGURATION_ERROR_MESSAGE}</p>
        <Button variant="primary" className="auth-submit" onClick={onRetry}>
          Retry
        </Button>
      </section>
    </main>
  );
}
