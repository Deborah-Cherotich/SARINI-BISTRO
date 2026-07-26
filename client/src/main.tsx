import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

const isElectron = navigator.userAgent.includes('Electron')

if (isElectron) {
  // The desktop app is already a real installed program — a service worker
  // only exists here to make the phone/browser path installable, and in
  // Electron it was doing actual harm: once registered, it kept serving a
  // cached copy of the JS/CSS bundle from a previous version even after
  // reinstalling a newer build, since Electron's persistent session (the
  // same mechanism that keeps "remember me" working) keeps the service
  // worker and its cache around across app restarts. Unregister anything
  // left over from an older build that did register one, and never
  // register a new one going forward.
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  })
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
} else {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
