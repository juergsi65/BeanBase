import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query'
// Globales CSS zuerst: legt die Layer-Reihenfolge (base < components < utilities) fest, bevor CSS-Module eigene @layer-Blöcke mitbringen
import './styles.css'
import App from './App'
import { installGlobalHaptics } from './lib/haptics'

installGlobalHaptics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
