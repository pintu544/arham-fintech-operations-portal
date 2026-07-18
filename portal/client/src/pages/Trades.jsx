import { useState, useEffect, useMemo } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import DataTable from '../components/DataTable'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react'

function formatINR(value) {
  if (value == null) return '₹0'
  return '₹' + Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCompactINR(value) {
  const amount = Number(value || 0)
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`
  return formatINR(amount)
}

function formatDate(dateValue) {
  if (!dateValue) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${dateValue}T00:00:00Z`))
}

const EMPTY_FILTERS = { clientId: '', startDate: '', endDate: '' }

export default function Trades() {
  const [trades, setTrades] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const { dataVersion } = useSocket()
  const { currentUser } = useAuth()

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value) params.set(key, value)
    }
    const query = params.toString()
    setLoading(true)
    setError('')
    apiRequest(`/api/trades${query ? `?${query}` : ''}`, {
      employeeId: currentUser.employeeId,
      signal: controller.signal
    })
      .then(result => setTrades(result.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [appliedFilters, currentUser.employeeId, dataVersion, requestVersion])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/api/clients', { employeeId: currentUser.employeeId, signal: controller.signal })
      .then(result => setClients(result.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
    return () => controller.abort()
  }, [currentUser.employeeId, dataVersion, requestVersion])

  const stats = useMemo(() => {
    const totalVolume = trades.reduce((sum, trade) => sum + (trade.quantity * trade.price), 0)
    const totalBrokerage = trades.reduce((sum, trade) => sum + trade.brokerage, 0)
    return { count: trades.length, totalVolume, totalBrokerage }
  }, [trades])

  const columns = [
    { key: 'tradeId', label: 'Trade ID' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'tradeDate', label: 'Date', render: value => formatDate(value) },
    { key: 'tradeType', label: 'Type', render: value => <span className={`badge ${value?.toLowerCase()}`}>{value}</span> },
    { key: 'symbol', label: 'Symbol' },
    { key: 'quantity', label: 'Qty' },
    { key: 'price', label: 'Price', render: value => formatINR(value) },
    { key: 'brokerage', label: 'Brokerage', render: value => formatINR(value) },
    { key: 'status', label: 'Status', render: value => <span className={`badge ${value?.toLowerCase()}`}>{value}</span> }
  ]

  const applyFilters = event => {
    event.preventDefault()
    setAppliedFilters({ ...draftFilters })
  }

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">Trades</h1>
      <p className="page-subtitle">Track and analyze trading activity by client and date</p>
      <form className="filter-bar" onSubmit={applyFilters}>
        <div className="form-group">
          <label className="form-label" htmlFor="trade-client">Client</label>
          <select id="trade-client" className="form-select" value={draftFilters.clientId} onChange={event => setDraftFilters(filters => ({ ...filters, clientId: event.target.value }))}>
            <option value="">All Clients</option>
            {clients.map(client => <option key={client.clientId} value={client.clientId}>{client.name} ({client.clientId})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="trade-start-date">Start Date</label>
          <input id="trade-start-date" type="date" className="form-input" value={draftFilters.startDate} onChange={event => setDraftFilters(filters => ({ ...filters, startDate: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="trade-end-date">End Date</label>
          <input id="trade-end-date" type="date" className="form-input" value={draftFilters.endDate} onChange={event => setDraftFilters(filters => ({ ...filters, endDate: event.target.value }))} />
        </div>
        <button type="submit" className="btn btn-primary">Apply</button>
        <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
      </form>
      <div className="stats-grid">
        <div className="stat-card blue">
          <BarChart3 className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{stats.count.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card amber">
          <TrendingUp className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Volume</div>
          <div className="stat-value">{formatCompactINR(stats.totalVolume)}</div>
        </div>
        <div className="stat-card emerald">
          <DollarSign className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Brokerage</div>
          <div className="stat-value">{formatCompactINR(stats.totalBrokerage)}</div>
        </div>
      </div>
      {error
        ? <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
        : <DataTable columns={columns} data={trades} loading={loading} emptyMessage="No trades match the current filters. Try adjusting the date range or client." emptyIcon={<BarChart3 size={48} />} />}
    </div>
  )
}
