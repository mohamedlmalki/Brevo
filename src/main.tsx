import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AccountProvider } from './contexts/AccountContext.tsx'
import { Toaster } from "@/components/ui/toaster"
import { JobProvider } from './contexts/JobContext.tsx' // Import the new provider

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccountProvider>
      <JobProvider> {/* Wrap App with the JobProvider */}
        <App />
      </JobProvider>
      <Toaster />
    </AccountProvider>
  </React.StrictMode>,
)