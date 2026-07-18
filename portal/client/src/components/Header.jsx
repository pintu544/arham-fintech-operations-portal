import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { Menu, RefreshCw } from 'lucide-react'

export default function Header({ onMenuToggle }) {
  const { syncStatus, triggerSync } = useSocket()
  const { employees, currentUser, login, logout, isManagement, directoryError } = useAuth()

  const handleRoleChange = event => {
    const employeeId = event.target.value
    if (!employeeId) return logout()
    const employee = employees.find(item => item.employeeId === employeeId)
    if (employee) login(employee)
  }

  const getInitials = () => {
    if (!currentUser) return '?'
    return (currentUser.name || '')
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  }

  const getSyncLabel = () => {
    if (!syncStatus.loaded) return 'Checking sync…'
    if (syncStatus.status === 'syncing') return 'Syncing…'
    if (syncStatus.status === 'error') return syncStatus.lastSuccessfulSync ? 'Stale data' : 'Sync error'
    return syncStatus.lastSuccessfulSync ? 'Synced' : 'Never synced'
  }

  const management = employees.filter(employee => employee.role === 'management')
  const relationshipManagers = employees.filter(employee => employee.role === 'relationship_manager')
  const lastSuccess = syncStatus.lastSuccessfulSync?.completedAt

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle navigation">
          <Menu size={22} strokeWidth={1.5} />
        </button>
        <div className="sync-indicator" title={lastSuccess ? `Last successful sync: ${new Date(lastSuccess).toLocaleString('en-IN')}` : syncStatus.message}>
          <span className={`sync-dot ${syncStatus.status}`} />
          <span>{getSyncLabel()}</span>
        </div>
        {isManagement && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => triggerSync(currentUser.employeeId).catch(() => {})}
            disabled={syncStatus.status === 'syncing'}
          >
            <span className={`btn-icon ${syncStatus.status === 'syncing' ? 'spinning' : ''}`}>
              <RefreshCw size={14} strokeWidth={2} />
            </span>
            Sync
          </button>
        )}
      </div>
      <div className="header-right">
        <div className="header-divider" />
        <div className="role-selector" title={directoryError || 'Assessment-only demo identity'}>
          <span className="role-label">View as</span>
          <select value={currentUser?.employeeId || ''} onChange={handleRoleChange} aria-label="Select demo identity">
            <option value="">Select employee…</option>
            {management.length > 0 && (
              <optgroup label="Management">
                {management.map(employee => <option key={employee.employeeId} value={employee.employeeId}>{employee.name} ({employee.employeeId})</option>)}
              </optgroup>
            )}
            {relationshipManagers.length > 0 && (
              <optgroup label="Relationship Managers">
                {relationshipManagers.map(employee => <option key={employee.employeeId} value={employee.employeeId}>{employee.name} ({employee.employeeId})</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="user-avatar" title={currentUser?.name || 'No employee selected'}>{getInitials()}</div>
      </div>
    </header>
  )
}
