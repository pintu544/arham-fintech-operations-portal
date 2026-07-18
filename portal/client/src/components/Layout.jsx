import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useSocket } from '../contexts/SocketContext'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

function ToastIcon({ type }) {
  if (type === 'error') return <XCircle size={16} strokeWidth={2.5} />
  if (type === 'warning') return <AlertTriangle size={16} strokeWidth={2.5} />
  return <CheckCircle2 size={16} strokeWidth={2.5} />
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toasts } = useSocket()

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} />
        <div className="page-content">
          {children}
        </div>
      </div>
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type || 'success'}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <ToastIcon type={t.type} />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
