import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { chomoApiPlugin } from './server/vite-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Always sync .env into process.env (including updated empty→filled values).
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }

  return {
    plugins: [react(), chomoApiPlugin()],
    server: {
      port: 5173,
    },
  }
})
