import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { apiRequest, ApiError } from '../lib/api'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [syncStatus, setSyncStatus] = useState({
    status: 'idle',
    message: '',
    lastSync: null,
    lastSuccessfulSync: null,
    loaded: false
  })
  const [dataVersion, setDataVersion] = useState(0)
  const [toasts, setToasts] = useState([])
  const socketRef = useRef(null)
  const lastSnapshotRef = useRef(null)

  const addToast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(previous => [...previous, { id, message, type }])
    setTimeout(() => setToasts(previous => previous.filter(toast => toast.id !== id)), 3500)
  }, [])

  const loadSyncStatus = useCallback(async () => {
    try {
      const result = await apiRequest('/api/sync/status')
      const latestTimestamp = result.lastSuccessfulSync?.completedAt || null
      if (latestTimestamp && latestTimestamp !== lastSnapshotRef.current) {
        lastSnapshotRef.current = latestTimestamp
        setDataVersion(version => version + 1)
      }
      setSyncStatus({
        status: result.currentStatus,
        message: result.message || '',
        lastSync: result.lastSync,
        lastSuccessfulSync: result.lastSuccessfulSync,
        loaded: true
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        setSyncStatus(previous => ({ ...previous, status: 'error', message: error.message, loaded: true }))
      }
    }
  }, [])

  useEffect(() => {
    loadSyncStatus()
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', loadSyncStatus)
    socket.on('sync-status', data => {
      setSyncStatus(previous => ({
        ...previous,
        status: data.status,
        message: data.message || '',
        loaded: true
      }))
    })
    socket.on('data-updated', data => {
      lastSnapshotRef.current = data.timestamp
      setDataVersion(version => version + 1)
      addToast('Data updated — showing the latest successful snapshot')
      loadSyncStatus()
    })
    socket.on('disconnect', () => {
      setSyncStatus(previous => ({ ...previous, message: 'Live updates disconnected; reconnecting…' }))
    })

    return () => socket.disconnect()
  }, [addToast, loadSyncStatus])

  const triggerSync = useCallback(async employeeId => {
    try {
      const result = await apiRequest('/api/sync/trigger', { method: 'POST', employeeId })
      addToast('Synchronization accepted')
      await loadSyncStatus()
      return result
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SYNC_IN_PROGRESS') {
        addToast('A synchronization is already running', 'warning')
      } else {
        addToast(error.message || 'Failed to start synchronization', 'error')
      }
      throw error
    }
  }, [addToast, loadSyncStatus])

  return (
    <SocketContext.Provider value={{ syncStatus, dataVersion, toasts, triggerSync, loadSyncStatus, addToast }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used within SocketProvider')
  return context
}
