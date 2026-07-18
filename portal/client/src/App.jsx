import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import IdentityRequired from './components/IdentityRequired'
import { useAuth } from './contexts/AuthContext'

const Overview = lazy(() => import('./pages/Overview'))
const Clients = lazy(() => import('./pages/Clients'))
const Trades = lazy(() => import('./pages/Trades'))
const MyClients = lazy(() => import('./pages/MyClients'))
const Employees = lazy(() => import('./pages/Employees'))
const Incentives = lazy(() => import('./pages/Incentives'))

export function ProtectedPage({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <IdentityRequired />
}

function PageLoader() {
  return (
    <div aria-label="Loading page">
      <div className="skeleton" style={{ height: 48, marginBottom: 24, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
    </div>
  )
}

export default function App() {
  const protectedPage = page => <ProtectedPage>{page}</ProtectedPage>

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={protectedPage(<Overview />)} />
          <Route path="/clients" element={protectedPage(<Clients />)} />
          <Route path="/trades" element={protectedPage(<Trades />)} />
          <Route path="/my-clients" element={protectedPage(<MyClients />)} />
          <Route path="/employees" element={protectedPage(<Employees />)} />
          <Route path="/incentives" element={protectedPage(<Incentives />)} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
