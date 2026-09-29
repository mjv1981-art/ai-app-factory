import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const Factory = lazy(() => import('./factory/Factory.jsx'))
const isFactory = location.pathname === '/factory' || location.pathname.startsWith('/factory/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isFactory ? <Suspense fallback={<p>Loading Factory…</p>}><Factory /></Suspense> : <App />}
  </StrictMode>,
)
