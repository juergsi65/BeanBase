import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Selten geänderte Libs in eigene Chunks → bleiben über Deploys hinweg im Browser-Cache
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ },
            { name: 'supabase', test: /node_modules[/\\]@supabase[/\\]/ },
            { name: 'tanstack', test: /node_modules[/\\]@tanstack[/\\]/ },
          ],
        },
      },
    },
  },
})
