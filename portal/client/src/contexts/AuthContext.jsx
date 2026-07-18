import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSocket } from './SocketContext'
import { apiRequest } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [employees, setEmployees] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [directoryError, setDirectoryError] = useState('')
  const { dataVersion } = useSocket()

  const fetchEmployees = useCallback(async signal => {
    try {
      const result = await apiRequest('/api/demo/users', { signal })
      const nextEmployees = result.data || []
      setEmployees(nextEmployees)
      setDirectoryError('')
      setCurrentUser(current => {
        if (!current) return null
        return nextEmployees.find(employee => employee.employeeId === current.employeeId) || null
      })
    } catch (error) {
      if (error.name !== 'AbortError') setDirectoryError(error.message)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchEmployees(controller.signal)
    return () => controller.abort()
  }, [dataVersion, fetchEmployees])

  const login = useCallback(employee => setCurrentUser(employee), [])
  const logout = useCallback(() => setCurrentUser(null), [])
  const isManagement = currentUser?.role === 'management'

  return (
    <AuthContext.Provider value={{
      employees,
      currentUser,
      login,
      logout,
      isManagement,
      directoryError,
      fetchEmployees
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
