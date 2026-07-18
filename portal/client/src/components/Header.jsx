import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { Menu, RefreshCw } from 'lucide-react'
import IdentitySelector from './IdentitySelector'

export default function Header({ onMenuToggle }) {
  const { syncStatus, triggerSync } = useSocket()
  const { currentUser, isManagement } = useAuth()

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

  const lastSuccess = syncStatus.lastSuccessfulSync?.completedAt
  const lastUpdated = lastSuccess
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastSuccess))
    : null

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle navigation">
          <Menu size={22} strokeWidth={1.5} />
        </button>
        <div className="sync-indicator" aria-live="polite" title={lastUpdated ? `Last successful sync: ${lastUpdated}` : syncStatus.message}>
          <span className={`sync-dot ${syncStatus.status}`} />
          <span className="sync-label">{getSyncLabel()}</span>
        </div>
        {lastUpdated && <time className="header-last-updated" dateTime={lastSuccess}>Updated {lastUpdated}</time>}
        {isManagement && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => triggerSync(currentUser.employeeId).catch(() => {})}
            disabled={syncStatus.status === 'syncing'}
            aria-label="Synchronize portal data"
            title="Synchronize portal data"
          >
            <span className={`btn-icon ${syncStatus.status === 'syncing' ? 'spinning' : ''}`}>
              <RefreshCw size={14} strokeWidth={2} />
            </span>
            <span className="sync-button-label">Sync</span>
          </button>
        )}
      </div>
      <div className="header-right">
        <div className="header-divider" />
        <IdentitySelector id="header-demo-identity" className="header-identity-selector" />
        <div className="user-avatar" title={currentUser?.name || 'No employee selected'}>{getInitials()}</div>
      </div>
    </header>
  )
}
