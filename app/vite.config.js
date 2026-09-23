import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The app started with Create React App. To keep the same build command and
// output on the server, REACT_APP_* variables are still read from the
// environment and .env files and replaced in the code as process.env.*, and
// the build still goes to build/.
export default defineConfig(({ mode }) => {
  const env = { REACT_APP_SERVER_DOMAIN: undefined, REACT_APP_SERVER_PORT: undefined, ...loadEnv(mode, process.cwd(), 'REACT_APP_') }
  return {
    plugins: [react()],
    define: Object.fromEntries(Object.entries(env).map(([key, value]) =>
      [`process.env.${key}`, value === undefined ? 'undefined' : JSON.stringify(value)])),
    build: {
      outDir: 'build',
      target: 'es2020',
    },
  }
})
