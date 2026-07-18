import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useSocket } from '../contexts/SocketContext'
import { CheckCircle2 } from 'lucide-react'

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
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <CheckCircle2 size={16} strokeWidth={2.5} />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
