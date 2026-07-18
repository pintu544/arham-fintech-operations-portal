import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  employees: [
    { employeeId: 'EMP001', name: 'Manager One', role: 'management' },
    { employeeId: 'EMP004', name: 'RM One', role: 'relationship_manager' }
  ],
  currentUser: null,
  login: vi.fn(),
  logout: vi.fn(),
  directoryError: ''
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }))

import IdentitySelector from './IdentitySelector'

test('selects validated identities and exposes the active role', async () => {
  const user = userEvent.setup()
  const view = render(<IdentitySelector id="test-identity" />)

  await user.selectOptions(screen.getByRole('combobox', { name: 'Select demo identity' }), 'EMP001')
  expect(authState.login).toHaveBeenCalledWith(authState.employees[0])

  authState.currentUser = authState.employees[0]
  view.rerender(<IdentitySelector id="test-identity" />)
  expect(screen.getByText('Management')).toBeInTheDocument()
})
