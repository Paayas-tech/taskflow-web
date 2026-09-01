export const CONFIGURATION_ERROR_MESSAGE =
  "TaskFlow setup is incomplete. Contact your administrator.";

export default function ConfigurationErrorScreen({ onRetry }) {
  return (
    <main className="configuration-error-page">
      <section
        className="configuration-error-card"
        role="alert"
        aria-labelledby="configuration-error-title"
      >
        <p className="card-label">Unavailable</p>
        <h1 id="configuration-error-title">Configuration required</h1>
        <p>{CONFIGURATION_ERROR_MESSAGE}</p>
        <button className="primary-btn" type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    </main>
  );
}
