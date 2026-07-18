import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, BarChart3, ClipboardList, Building2, Banknote } from 'lucide-react'

export default function Sidebar({ open, onClose }) {
  const { currentUser } = useAuth()
  const isEmployee = currentUser && currentUser.role === 'relationship_manager'

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h1>Operations Portal</h1>
        <span>Arham Fintech</span>
      </div>
      <nav className="sidebar-nav" onClick={onClose}>
        <NavLink to="/overview" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><LayoutDashboard size={20} strokeWidth={1.5} /></span>
          Overview
        </NavLink>
        <NavLink to="/clients" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><Users size={20} strokeWidth={1.5} /></span>
          Clients
        </NavLink>
        <NavLink to="/trades" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><BarChart3 size={20} strokeWidth={1.5} /></span>
          Trades
        </NavLink>
        {isEmployee && (
          <NavLink to="/my-clients" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><ClipboardList size={20} strokeWidth={1.5} /></span>
            My Clients
          </NavLink>
        )}
        <NavLink to="/employees" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><Building2 size={20} strokeWidth={1.5} /></span>
          Employees
        </NavLink>
        <NavLink to="/incentives" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><Banknote size={20} strokeWidth={1.5} /></span>
          Incentives
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <span className="version-dot"></span>
        <span>v1.0.0 · Operational</span>
      </div>
    </aside>
  )
}
