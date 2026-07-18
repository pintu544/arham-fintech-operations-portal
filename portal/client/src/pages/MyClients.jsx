import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import DataTable from '../components/DataTable'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { ClipboardList, UserCheck, Lock, ShieldAlert } from 'lucide-react'

export default function MyClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { currentUser } = useAuth()
  const { dataVersion } = useSocket()

  const isRM = currentUser?.role === 'relationship_manager'

  useEffect(() => {
    if (!isRM) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    apiRequest('/api/my-clients', { employeeId: currentUser.employeeId, signal: controller.signal })
      .then(json => setClients(json.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isRM, currentUser?.employeeId, dataVersion, requestVersion])

  const columns = [
    { key: 'clientId', label: 'Client ID' },
    { key: 'name', label: 'Name' },
    { key: 'pan', label: 'PAN' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'City' },
    { key: 'accountType', label: 'Account Type' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v?.toLowerCase()}`}>{v}</span> }
  ]

  if (!currentUser) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        <h1 className="page-title">My Clients</h1>
        <div className="empty-state">
          <Lock size={48} className="empty-icon" />
          <div className="empty-title">No role selected</div>
          <div className="empty-desc">Use the role selector in the header to log in as an employee. Once you're signed in as a relationship manager, your assigned clients will appear here.</div>
        </div>
      </div>
    )
  }

  if (!isRM) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        <h1 className="page-title">My Clients</h1>
        <div className="empty-state">
          <ShieldAlert size={48} className="empty-icon" />
          <div className="empty-title">Management View</div>
          <div className="empty-desc">Client mapping is available for relationship managers only. Switch to an RM role in the header to view your assigned clients.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">My Clients — {currentUser.name}</h1>
      <p className="page-subtitle">View clients assigned to your portfolio</p>
      <div className="stats-grid">
        <div className="stat-card blue">
          <ClipboardList className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Mapped Clients</div>
          <div className="stat-value">{clients.length}</div>
        </div>
        <div className="stat-card emerald">
          <UserCheck className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Active</div>
          <div className="stat-value">{clients.filter(c => c.status === 'Active').length}</div>
        </div>
      </div>
      {error
        ? <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
        : <DataTable columns={columns} data={clients} loading={loading} emptyMessage="No clients are currently mapped to your account. Contact your manager if you believe this is an error." emptyIcon={<ClipboardList size={48} />} />}
    </div>
  )
}
