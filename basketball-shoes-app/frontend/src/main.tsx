import React from 'react'
import ReactDOM from 'react-dom/client'
import { OpenFeature } from '@openfeature/web-sdk'
import { FlagdWebProvider } from '@openfeature/flagd-web-provider'
import App from './App'
import './index.css'

// Initialize OpenFeature with flagd provider
// Note: In production, configure host/port based on your deployment
try {
  const flagdProvider = new FlagdWebProvider({
    host: window.location.hostname,
    port: 8013,
    tls: false,
  })

  OpenFeature.setProvider(flagdProvider)
} catch (error) {
  console.warn('Failed to initialize OpenFeature:', error)
  // App will continue with default flag values
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
