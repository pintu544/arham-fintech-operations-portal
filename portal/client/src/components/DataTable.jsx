import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const ROWS_PER_PAGE = 20

export default function DataTable({ columns, data, loading, emptyMessage = 'No data available', emptyIcon }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedData = sorted.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE)
  const startRow = sorted.length > 0 ? (safePage - 1) * ROWS_PER_PAGE + 1 : 0
  const endRow = Math.min(safePage * ROWS_PER_PAGE, sorted.length)

  // New filters or snapshots should never leave the table on an out-of-date page.
  useEffect(() => { setCurrentPage(1) }, [search, data])

  if (loading) {
    return (
      <div className="table-container">
        <div className="table-toolbar">
          <div className="skeleton" style={{ width: 240, height: 36 }} />
          <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 20 }} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            {columns.map((_, j) => (
              <div
                key={j}
                className="skeleton skeleton-cell"
                style={{ flex: j === 0 ? 0.6 : 1, animationDelay: `${j * 80}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <div className="search-wrapper">
          <Search size={16} strokeWidth={2} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search across all columns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="record-count">
          {sorted.length} record{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{emptyIcon}</div>
          <div className="empty-title">{emptyMessage}</div>
          <div className="empty-desc">Try adjusting your search or filters to find what you're looking for</div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={sortKey === col.key ? 'sorted' : ''}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="sort-icon">
                          {sortDir === 'asc' ? <ChevronUp size={12} strokeWidth={3} style={{ display: 'inline' }} /> : <ChevronDown size={12} strokeWidth={3} style={{ display: 'inline' }} />}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, i) => (
                  <tr key={row.id || row.clientId || row.tradeId || row.employeeId || i}>
                    {columns.map(col => (
                      <td key={col.key}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="table-pagination">
              <span className="page-info">
                Showing {startRow}–{endRow} of {sorted.length}
              </span>
              <div className="page-controls">
                <button
                  className="page-btn"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', padding: '0 8px' }}>
                  {safePage} / {totalPages}
                </span>
                <button
                  className="page-btn"
                  aria-label="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
