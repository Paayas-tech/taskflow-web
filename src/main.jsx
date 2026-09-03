import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))

const renderApp = () =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Visual QA harness: only bundled in development, never in production.
if (import.meta.env.DEV && window.location.pathname === '/__preview') {
  import('./dev/PreviewApp.jsx')
    .then(({ default: PreviewApp }) =>
      root.render(
        <StrictMode>
          <PreviewApp />
        </StrictMode>,
      ),
    )
    .catch((error) => {
      console.error('The preview harness could not be loaded:', error)
      renderApp()
    })
} else {
  renderApp()
}
