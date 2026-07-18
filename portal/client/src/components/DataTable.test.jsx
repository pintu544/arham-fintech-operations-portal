import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import DataTable from './DataTable'

const columns = [{ key: 'name', label: 'Name' }]

test('returns to the first page when a fresh dataset arrives', async () => {
  const user = userEvent.setup()
  const initialData = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: `Row ${index + 1}` }))
  const { rerender } = render(<DataTable columns={columns} data={initialData} loading={false} />)

  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByText('Row 21')).toBeInTheDocument()

  const freshData = Array.from({ length: 5 }, (_, index) => ({ id: index + 100, name: `Fresh ${index + 1}` }))
  rerender(<DataTable columns={columns} data={freshData} loading={false} />)
  expect(await screen.findByText('Fresh 1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
})

test('exposes keyboard-operable sorting and the active sort direction', async () => {
  const user = userEvent.setup()
  const view = render(<DataTable columns={columns} data={[{ id: 1, name: 'Zulu' }, { id: 2, name: 'Alpha' }]} loading={false} />)
  const table = within(view.container)

  const columnHeader = table.getByRole('columnheader', { name: 'Name' })
  const sortButton = table.getByRole('button', { name: 'Name' })
  expect(columnHeader).toHaveAttribute('aria-sort', 'none')

  await user.click(sortButton)
  expect(columnHeader).toHaveAttribute('aria-sort', 'ascending')
  expect(table.getAllByRole('row')[1]).toHaveTextContent('Alpha')

  await user.click(sortButton)
  expect(columnHeader).toHaveAttribute('aria-sort', 'descending')
  expect(table.getAllByRole('row')[1]).toHaveTextContent('Zulu')
})
