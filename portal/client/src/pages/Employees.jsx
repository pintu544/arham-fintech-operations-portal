import { useState, useEffect, useMemo } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import DataTable from '../components/DataTable'
import ErrorState from '../components/ErrorState'
import { apiRequest } from '../lib/api'
import { Building2, UserCircle, Users2 } from 'lucide-react'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { dataVersion } = useSocket()
  const { currentUser } = useAuth()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    apiRequest('/api/employees', { employeeId: currentUser.employeeId, signal: controller.signal })
      .then(json => setEmployees(json.data || []))
      .catch(requestError => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [currentUser.employeeId, dataVersion, requestVersion])

  const stats = useMemo(() => {
    const mgmt = employees.filter(e => e.role === 'management').length
    const rms = employees.filter(e => e.role === 'relationship_manager').length
    return { total: employees.length, mgmt, rms }
  }, [employees])

  const columns = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (v) => <span className={`badge ${v}`}>{v === 'management' ? 'Management' : 'Relationship Manager'}</span> },
    { key: 'department', label: 'Department' },
    { key: 'phone', label: 'Phone' }
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 className="page-title">Employees</h1>
      <p className="page-subtitle">Directory of all employees and their roles</p>
      <div className="stats-grid">
        <div className="stat-card blue">
          <Building2 className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Total Employees</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card purple">
          <UserCircle className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Management</div>
          <div className="stat-value">{stats.mgmt}</div>
        </div>
        <div className="stat-card emerald">
          <Users2 className="stat-icon" size={28} style={{ opacity: 0.12 }} />
          <div className="stat-label">Relationship Managers</div>
          <div className="stat-value">{stats.rms}</div>
        </div>
      </div>
      {error
        ? <ErrorState message={error} onRetry={() => setRequestVersion(version => version + 1)} />
        : <DataTable columns={columns} data={employees} loading={loading} emptyMessage="No employees found in the directory. Employee data will be available after the next sync." emptyIcon={<Building2 size={48} />} />}
    </div>
  )
}
