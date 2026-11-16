// Ein QueryClient für die ganze App – auch außerhalb von React nutzbar (z. B. settings.js)
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})
