import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './preferences.css'
import './event-colors.css'
import './daily-memo.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)

// Offline support + auto-update for the installed PWA. Production only, so dev HMR is untouched.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // When a newly-deployed service worker takes control, reload once to get the new app.
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Check for a new version now, on tab focus, and hourly.
      reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    }).catch(() => {})
  })
}
