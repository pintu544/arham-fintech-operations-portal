import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: {},
  apiRequest: vi.fn(async () => ({
    currentStatus: 'idle', message: '', lastSync: null,
    lastSuccessfulSync: { completedAt: '2026-07-18T00:00:00.000Z' }
  }))
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event, handler) => { mocks.handlers[event] = handler },
    disconnect: vi.fn()
  })
}))
vi.mock('../lib/api', () => ({
  apiRequest: mocks.apiRequest,
  ApiError: class ApiError extends Error {}
}))

import { SocketProvider, useSocket } from './SocketContext'

function SocketProbe() {
  const { syncStatus, dataVersion } = useSocket()
  return <div>{syncStatus.loaded ? 'loaded' : 'loading'}:{dataVersion}</div>
}

test('loads sync status and increments dataVersion on data-updated', async () => {
  render(<SocketProvider><SocketProbe /></SocketProvider>)
  expect(await screen.findByText('loaded:1')).toBeInTheDocument()

  act(() => mocks.handlers['data-updated']({ timestamp: '2026-07-18T00:00:00.000Z' }))
  expect(screen.getByText('loaded:2')).toBeInTheDocument()
  await waitFor(() => expect(mocks.apiRequest.mock.calls.length).toBeGreaterThanOrEqual(2))
})
