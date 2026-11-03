// This is the starting point of the app: it attaches React to the HTML page
// and makes navigation, preview data, and account details available everywhere.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DemoProvider } from './context/DemoContext'
import { recordClientError } from './lib/errorMessages'
import './index.css'

class RuntimeErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    recordClientError(error, 'react_render_error')
  }

  render() {
    if (this.state.hasError) {
      return <main className="page"><p className="error-text" role="alert">Something went wrong. Please refresh and try again.</p></main>
    }
    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  recordClientError(event.error, 'client_runtime_error')
})

window.addEventListener('unhandledrejection', (event) => {
  recordClientError(event.reason, 'unhandled_rejection')
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <BrowserRouter>
        {/* Preview data wraps account data so either mode can share the same pages. */}
        <DemoProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </RuntimeErrorBoundary>
  </React.StrictMode>
)
