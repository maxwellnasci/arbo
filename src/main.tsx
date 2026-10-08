import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { BrandProvider } from './contexts/BrandContext'
import { initSentry } from './lib/sentry'
import { installChunkErrorHandlers } from './lib/chunkRecovery'

initSentry()
// Erro de chunk fora de Error Boundary (preload do Vite / import() solto):
// limpa o cache do service worker e recarrega com o deploy atual.
installChunkErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrandProvider>
        <App />
      </BrandProvider>
    </AuthProvider>
  </StrictMode>,
)
