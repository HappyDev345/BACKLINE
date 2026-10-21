// Vite runs the local development site and builds the files used for hosting.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This plugin lets Vite understand React components written in JSX.
  plugins: [react()],
})
