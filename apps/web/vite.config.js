import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Preserve the repository-level .env/.env.local location after moving Vite.
  envDir: '../..',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    // The unit suite never talks to Supabase: it runs against the in-memory
    // fake api. These placeholders keep `src/api/client.js` deterministic — the
    // same values on every machine and in CI, and never a real project — so a
    // developer's local `.env` can neither change a result nor be reached.
    env: {
      VITE_API_BASE_URL: '/api',
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
