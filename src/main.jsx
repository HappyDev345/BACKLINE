// This is the starting point of the app: it attaches React to the HTML page
// and makes navigation, preview data, and account details available everywhere.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DemoProvider } from './context/DemoContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Preview data wraps account data so either mode can share the same pages. */}
      <DemoProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DemoProvider>
    </BrowserRouter>
  </React.StrictMode>
)
