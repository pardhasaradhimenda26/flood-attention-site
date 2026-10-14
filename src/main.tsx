import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'

// A tab left open across a deploy asks for lazy chunks the new build no longer
// has. Reload once to pick up the new build instead of leaving a section blank.
// (No preventDefault: that would resolve the import to undefined and crash the
// lazy component before the reload lands.)
window.addEventListener('vite:preloadError', () => {
  const key = 'reloaded-after-deploy'
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
