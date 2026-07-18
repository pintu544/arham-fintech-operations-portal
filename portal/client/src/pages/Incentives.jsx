import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import DataTable from '../components/DataTable'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { Banknote, BarChart3, TrendingUp, Lightbulb } from 'lucide-react'

function formatINR(val) {
  if (val == null) return '₹0'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Incentives() {
  const [incentives, setIncentives] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { currentUser, isManagement } = useAuth()
  const { dataVersion } = useSocket()

  useEffect(() => {
    if (!currentUser) {
      setIncentives([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    apiRequest('/api/incentives', { employeeId: currentUser.employeeId, signal: controller.signal })
      .then(json => setIncentives(json.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [currentUser, dataVersion, requestVersion])

  const stats = useMemo(() => {
    const totalIncentive = incentives.reduce((s, i) => s + (i.incentiveAmount || 0), 0)
    const avgIncentive = incentives.length > 0 ? totalIncentive / incentives.length : 0
    const totalBrokerage = incentives.reduce((s, i) => s + (i.totalBrokerage || 0), 0)
    return { totalIncentive, avgIncentive, totalBrokerage }
  }, [incentives])

  const columns = [
    { key: 'employeeName', label: 'Employee' },
    { key: 'employeeId', label: 'ID' },
    { key: 'clientCount', label: 'Clients' },
    { key: 'tradeCount', label: 'Trades' },
    { key: 'totalBrokerage', label: 'Total Brokerage', render: (v) => formatINR(v) },
    { key: 'incentiveRate', label: 'Rate', render: (v) => `${((v || 0) * 100).toFixed(0)}%` },
    { key: 'incentiveAmount', label: 'Incentive Amount', render: (v) => <strong style={{ color: 'var(--accent-emerald)' }}>{formatINR(v)}</strong> }
  ]

  const subtitle = currentUser && !isManagement
    ? 'Your performance-based incentive breakdown'
    : 'Incentive breakdown for all relationship managers'

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">
        Incentives {currentUser && !isManagement ? `— ${currentUser.name}` : '— All Employees'}
      </h1>
      <p className="page-subtitle">{subtitle}</p>
      {!currentUser && (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          <Lightbulb size={48} className="empty-icon" />
          <div className="empty-desc">Select a role in the header to see scoped incentive data</div>
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-card emerald">
          <Banknote className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Incentives</div>
          <div className="stat-value">{formatINR(stats.totalIncentive)}</div>
        </div>
        <div className="stat-card amber">
          <BarChart3 className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Brokerage</div>
          <div className="stat-value">{formatINR(stats.totalBrokerage)}</div>
        </div>
        <div className="stat-card purple">
          <TrendingUp className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Avg Incentive</div>
          <div className="stat-value">{formatINR(stats.avgIncentive)}</div>
        </div>
      </div>
      {error
        ? <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
        : <DataTable columns={columns} data={incentives} loading={loading} emptyMessage="No incentive data is available for the selected employee." emptyIcon={<Banknote size={48} />} />}
    </div>
  )
}
