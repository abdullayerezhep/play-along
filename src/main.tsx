import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource/big-shoulders-display/latin-600'
import '@fontsource/big-shoulders-display/latin-800'
import '@fontsource/instrument-sans/latin-400'
import '@fontsource/instrument-sans/latin-600'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
