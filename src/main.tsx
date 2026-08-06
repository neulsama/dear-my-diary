import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './preferences.css'
import './event-colors.css'
import './daily-memo.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)

// Offline support for the installed PWA. Production only, so dev HMR is untouched.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
