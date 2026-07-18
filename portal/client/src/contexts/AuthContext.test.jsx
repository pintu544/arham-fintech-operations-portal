import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  socketState: { dataVersion: 0 },
  directory: []
}))

vi.mock('../lib/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('./SocketContext', () => ({ useSocket: () => mocks.socketState }))

import { AuthProvider, useAuth } from './AuthContext'

function DirectoryProbe() {
  const { employees } = useAuth()
  return <div>{employees.map(employee => employee.employeeId).join(',')}</div>
}

beforeEach(() => {
  mocks.socketState.dataVersion = 0
  mocks.directory = [{ employeeId: 'EMP004', name: 'RM One', role: 'relationship_manager' }]
  mocks.apiRequest.mockReset()
  mocks.apiRequest.mockImplementation(async () => ({ data: mocks.directory }))
})

test('refreshes the demo identity directory after dataVersion changes', async () => {
  const view = render(<AuthProvider><DirectoryProbe /></AuthProvider>)
  expect(await screen.findByText('EMP004')).toBeInTheDocument()

  mocks.directory = [
    { employeeId: 'EMP001', name: 'Manager', role: 'management' },
    { employeeId: 'EMP004', name: 'RM One', role: 'relationship_manager' }
  ]
  mocks.socketState.dataVersion = 1
  view.rerender(<AuthProvider><DirectoryProbe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('EMP001,EMP004')).toBeInTheDocument())
})
