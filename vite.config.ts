import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { perfRelay } from './tools/perf/relay.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), perfRelay()],
})
