import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  socketState: { dataVersion: 0 }
}))

vi.mock('../lib/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => mocks.socketState }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { employeeId: 'EMP004', name: 'RM One', role: 'relationship_manager' } })
}))

import Trades from './Trades'

beforeEach(() => {
  mocks.socketState.dataVersion = 0
  mocks.apiRequest.mockReset()
  mocks.apiRequest.mockImplementation(async path => {
    if (path === '/api/clients') return { data: [{ clientId: 'CL001', name: 'Client One' }] }
    return {
      data: [{
        tradeId: 'TR00001', clientId: 'CL001', tradeDate: '2026-06-01', tradeType: 'BUY',
        symbol: 'TCS', quantity: 10, price: 100, brokerage: 5, status: 'Settled'
      }]
    }
  })
})

test('renders tradeType and refetches after a successful data update', async () => {
  const { rerender } = render(<Trades />)
  expect(await screen.findByText('BUY')).toBeInTheDocument()
  expect(mocks.apiRequest).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ employeeId: 'EMP004' }))
  const initialCallCount = mocks.apiRequest.mock.calls.length

  mocks.socketState.dataVersion = 1
  rerender(<Trades />)
  await waitFor(() => expect(mocks.apiRequest.mock.calls.length).toBeGreaterThan(initialCallCount))
})

test('shows a retryable error instead of silently clearing data', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Portal unavailable'))
  render(<Trades />)
  expect(await screen.findByText('Unable to load data')).toBeInTheDocument()
  expect(screen.getByText('Portal unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})
