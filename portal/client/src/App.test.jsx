import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const authState = vi.hoisted(() => ({ currentUser: null }))
vi.mock('./contexts/AuthContext', () => ({ useAuth: () => authState }))

import { ProtectedPage } from './App'

test('keeps internal screens protected until a demo identity is selected', () => {
  const view = render(<ProtectedPage><div>Protected content</div></ProtectedPage>)
  expect(screen.getByText('Select an employee')).toBeInTheDocument()
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument()

  authState.currentUser = { employeeId: 'EMP004', role: 'relationship_manager' }
  view.rerender(<ProtectedPage><div>Protected content</div></ProtectedPage>)
  expect(screen.getByText('Protected content')).toBeInTheDocument()
})
