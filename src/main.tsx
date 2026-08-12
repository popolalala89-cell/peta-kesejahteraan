import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './theme.css'
import App from './App'
import { AuthProvider } from './context/Auth'
import { ToastProvider } from './context/Toast'

// Pulihkan path asli setelah redirect dari 404.html (refresh di sub-halaman GH Pages)
const pkRedirect = sessionStorage.getItem('pk_redirect')
if (pkRedirect) {
  sessionStorage.removeItem('pk_redirect')
  const base = import.meta.env.BASE_URL || '/'
  window.history.replaceState(null, '', base.replace(/\/$/, '') + pkRedirect)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)