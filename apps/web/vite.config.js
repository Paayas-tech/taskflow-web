import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Preserve the repository-level .env/.env.local location after moving Vite.
  envDir: '../..',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    // The unit suite never talks to Supabase: it runs against the in-memory
    // fake api. These placeholders keep `src/api/client.js` deterministic — the
    // same values on every machine and in CI, and never a real project — so a
    // developer's local `.env` can neither change a result nor be reached.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            {
              name: 'drag-and-drop',
              test: /node_modules[\\/]@dnd-kit[\\/]/,
            },
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
