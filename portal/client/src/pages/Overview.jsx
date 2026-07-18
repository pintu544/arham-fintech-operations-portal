import { useState, useEffect, useMemo } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, Activity, Briefcase } from 'lucide-react'

export default function Overview() {
  const [clients, setClients] = useState([])
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { dataVersion, syncStatus } = useSocket()
  const { currentUser } = useAuth()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      apiRequest('/api/clients', { employeeId: currentUser.employeeId, signal: controller.signal }),
      apiRequest('/api/trades', { employeeId: currentUser.employeeId, signal: controller.signal })
    ])
    .then(([clientsRes, tradesRes]) => {
      setClients(clientsRes.data || [])
      setTrades(tradesRes.data || [])
    })
    .catch(requestError => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [currentUser.employeeId, dataVersion, requestVersion])

  const stats = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'Active').length
    const totalVolume = trades.reduce((sum, t) => sum + (t.quantity * t.price), 0)
    const totalBrokerage = trades.reduce((sum, t) => sum + t.brokerage, 0)
    
    return {
      activeClients,
      totalVolume,
      totalBrokerage,
      totalTrades: trades.length
    }
  }, [clients, trades])

  // Process data for charts
  const volumeData = useMemo(() => {
    // Group trades by date
    const grouped = trades.reduce((acc, t) => {
      const dateStr = new Date(t.tradeDate).toISOString().split('T')[0]
      if (!acc[dateStr]) acc[dateStr] = { date: dateStr, volume: 0, count: 0 }
      acc[dateStr].volume += (t.quantity * t.price)
      acc[dateStr].count += 1
      return acc
    }, {})
    
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).slice(-14) // Last 14 days
  }, [trades])

  const clientTypeData = useMemo(() => {
    const grouped = clients.reduce((acc, c) => {
      acc[c.accountType] = (acc[c.accountType] || 0) + 1
      return acc
    }, {})
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [clients])

  const formatINR = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`
    return `₹${val.toLocaleString('en-IN')}`
  }

  const COLORS = ['#638eff', '#34d399', '#fbbf24', '#a78bfa', '#fb7185']
  const lastUpdated = syncStatus.lastSuccessfulSync?.completedAt
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(syncStatus.lastSuccessfulSync.completedAt))
    : null

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(17, 22, 38, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{ color: '#eaecf5', margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color || '#eaecf5', margin: '4px 0', fontSize: '12px' }}>
              {entry.name}: {entry.name.includes('Volume') ? formatINR(entry.value) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard Overview</h1>
        <div className="skeleton" style={{ height: 100, marginBottom: 24, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Dashboard Overview</h1>
        <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">Dashboard Overview</h1>
      <p className="page-subtitle overview-subtitle">
        <span>Latest synchronized performance metrics and trading analytics</span>
        {lastUpdated && <time dateTime={syncStatus.lastSuccessfulSync.completedAt}>Last updated {lastUpdated}</time>}
      </p>

      <div className="stats-grid">
        <div className="stat-card blue">
          <Activity className="stat-icon" size={28} style={{ opacity: 0.15 }} />
          <div className="stat-label">Total Trade Volume</div>
          <div className="stat-value">{formatINR(stats.totalVolume)}</div>
        </div>
        <div className="stat-card emerald">
          <Briefcase className="stat-icon" size={28} style={{ opacity: 0.15 }} />
          <div className="stat-label">Total Brokerage</div>
          <div className="stat-value">{formatINR(stats.totalBrokerage)}</div>
        </div>
        <div className="stat-card amber">
          <TrendingUp className="stat-icon" size={28} style={{ opacity: 0.15 }} />
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{stats.totalTrades.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card purple">
          <Users className="stat-icon" size={28} style={{ opacity: 0.15 }} />
          <div className="stat-label">Active Clients</div>
          <div className="stat-value">{stats.activeClients.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="overview-chart-grid">
        
        {/* Trading Volume Chart */}
        <div style={{ 
          background: 'var(--bg-card)', 
          borderRadius: '16px', 
          padding: '24px',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-card)',
          backdropFilter: 'blur(16px)'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
            Daily Trading Volume (Last 14 Days)
          </h3>
          <div style={{ width: '100%', height: 300 }} role="img" aria-label="Daily trading volume for the last 14 days">
            <ResponsiveContainer>
              <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => formatINR(val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  name="Volume"
                  stroke="var(--accent-blue)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Demographics Chart */}
        <div style={{ 
          background: 'var(--bg-card)', 
          borderRadius: '16px', 
          padding: '24px',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-card)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
            Client Account Distribution
          </h3>
          <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="img" aria-label="Client account type distribution">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={clientTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {clientTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '16px' }}>
            {clientTypeData.map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
