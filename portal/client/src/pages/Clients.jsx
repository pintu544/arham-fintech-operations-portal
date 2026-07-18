import { useState, useEffect, useMemo } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import DataTable from '../components/DataTable'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { Users, UserCheck, UserX } from 'lucide-react'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { dataVersion } = useSocket()
  const { currentUser } = useAuth()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    apiRequest('/api/clients', { employeeId: currentUser.employeeId, signal: controller.signal })
      .then(json => setClients(json.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [currentUser.employeeId, dataVersion, requestVersion])

  const stats = useMemo(() => {
    const active = clients.filter(c => c.status === 'Active').length
    return { total: clients.length, active, inactive: clients.length - active }
  }, [clients])

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

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">Clients</h1>
      <p className="page-subtitle">Manage and monitor all registered clients across your portfolio</p>
      <div className="stats-grid">
        <div className="stat-card blue">
          <Users className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Clients</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card emerald">
          <UserCheck className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Active</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card rose">
          <UserX className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Inactive</div>
          <div className="stat-value">{stats.inactive}</div>
        </div>
      </div>
      {error
        ? <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
        : <DataTable columns={columns} data={clients} loading={loading} emptyMessage="No clients have been registered yet. Client data will appear here once available." emptyIcon={<Users size={48} />} />}
    </div>
  )
}
