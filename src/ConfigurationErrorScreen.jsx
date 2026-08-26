export const CONFIGURATION_ERROR_MESSAGE =
  "TaskFlow is temporarily unavailable because its application configuration is incomplete. Please contact the administrator.";

export default function ConfigurationErrorScreen({ onRetry }) {
  return (
    <main className="configuration-error-page">
      <section
        className="configuration-error-card"
        role="alert"
        aria-labelledby="configuration-error-title"
      >
        <p className="card-label">TaskFlow unavailable</p>
        <h1 id="configuration-error-title">Configuration required</h1>
        <p>{CONFIGURATION_ERROR_MESSAGE}</p>
        <button className="primary-btn" type="button" onClick={onRetry}>
          Reload TaskFlow
        </button>
      </section>
    </main>
  );
}
