import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GH Pages deploy di subpath: https://popolalala89-cell.github.io/peta-kesejahteraan/
export default defineConfig({
  plugins: [react()],
  base: '/peta-kesejahteraan/',
})