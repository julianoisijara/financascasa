import React from 'react'
import ReactDOM from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { emitSaveError } from './lib/events'
import './assets/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  },
  // Toda mutação grava o finance-data.json; uma falha (disco, nuvem, off-line)
  // é mostrada num aviso global em vez de passar despercebida.
  mutationCache: new MutationCache({
    onError: (error) => {
      emitSaveError(error instanceof Error ? error.message : String(error))
    }
  })
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
