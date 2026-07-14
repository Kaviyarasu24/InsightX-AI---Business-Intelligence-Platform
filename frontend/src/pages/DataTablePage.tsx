import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type ColumnMeta = {
  name: string
  type: 'Numeric' | 'Datetime' | 'Text' | string
  raw_type: string
  missing_count: number
  missing_percent: number
  unique_count: number
}

type DatasetResponse = {
  headers: string[]
  rows: any[][]
  columns: ColumnMeta[]
  page: number
  limit: number
  total_rows: number
  total_filtered: number
}

export function DataTablePage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')

  // Table parameters state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Search state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Column filter state
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const [isColSelectorOpen, setIsColSelectorOpen] = useState(false)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Fetch paginated, sorted, and filtered data
  const { data, isLoading, error } = useQuery<DatasetResponse | null>({
    queryKey: ['dataset-data', fileId, page, limit, sortBy, sortOrder, search, JSON.stringify(filters)],
    queryFn: async () => {
      if (!fileId) return null
      const response = await axios.get(`http://localhost:8000/api/v1/datasets/${fileId}/data`, {
        params: {
          page,
          limit,
          sort_by: sortBy || undefined,
          sort_order: sortOrder,
          search: search || undefined,
          filters: Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined,
        },
      })
      return response.data
    },
    enabled: !!fileId,
  })

  // Initialize visible columns when data is loaded
  useEffect(() => {
    if (data?.headers && visibleColumns.size === 0) {
      setVisibleColumns(new Set(data.headers))
    }
  }, [data, visibleColumns])

  // Total pages calculation
  const totalPages = useMemo(() => {
    if (!data) return 0
    return Math.ceil(data.total_filtered / limit)
  }, [data, limit])

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return search.trim() !== '' || sortBy !== '' || Object.keys(filters).length > 0
  }, [search, sortBy, filters])

  // Clear all sorting, search, and filters
  const resetAllFilters = () => {
    setSearchInput('')
    setSearch('')
    setSortBy('')
    setSortOrder('asc')
    setFilters({})
    setPage(1)
  }

  // Handle individual column header click for sorting
  const handleSort = (colName: string) => {
    if (sortBy === colName) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        // Clear sorting on third click
        setSortBy('')
        setSortOrder('asc')
      }
    } else {
      setSortBy(colName)
      setSortOrder('asc')
    }
    setPage(1)
  }

  // Handle column visibility toggle
  const toggleColumnVisibility = (colName: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(colName)) {
        // Don't allow hiding the last column
        if (next.size > 1) {
          next.delete(colName)
        }
      } else {
        next.add(colName)
      }
      return next
    })
  }

  // Handle column filter update
  const handleColumnFilterChange = (colName: string, val: any, filterType: 'text' | 'numeric-min' | 'numeric-max') => {
    setFilters((prev) => {
      const next = { ...prev }
      
      if (filterType === 'text') {
        if (val === '') {
          delete next[colName]
        } else {
          next[colName] = val
        }
      } else {
        // Numeric range handling
        const currentRange = next[colName] && typeof next[colName] === 'object' ? { ...next[colName] } : { min: '', max: '' }
        
        if (filterType === 'numeric-min') currentRange.min = val
        if (filterType === 'numeric-max') currentRange.max = val

        if (currentRange.min === '' && currentRange.max === '') {
          delete next[colName]
        } else {
          next[colName] = currentRange
        }
      }
      
      return next
    })
    setPage(1)
  }

  // Show page number array for rendering
  const paginationRange = useMemo(() => {
    const range = []
    const buffer = 1
    const start = Math.max(1, page - buffer)
    const end = Math.min(totalPages, page + buffer)

    if (start > 1) {
      range.push(1)
      if (start > 2) range.push('...')
    }

    for (let i = start; i <= end; i++) {
      range.push(i)
    }

    if (end < totalPages) {
      if (end < totalPages - 1) range.push('...')
      range.push(totalPages)
    }

    return range
  }, [page, totalPages])

  if (!fileId) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-10"
        >
          <div className="inline-flex rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-rose-200">
            No active dataset
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">No dataset has been loaded</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Please upload an Excel or CSV spreadsheet on the upload page to view the interactive data table.
          </p>
          <Link
            to="/upload"
            className="mt-8 inline-flex rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            Go to upload workspace
          </Link>
        </motion.div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2rem] border border-rose-500/20 bg-rose-950/20 p-8 shadow-2xl backdrop-blur-2xl sm:p-10"
        >
          <div className="inline-flex rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-rose-200">
            Error loading data
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Failed to load dataset data</h1>
          <p className="mt-4 text-sm leading-7 text-rose-200">
            {error instanceof Error ? error.message : 'An error occurred while querying the database.'}
          </p>
          <Link
            to="/upload"
            className="mt-8 inline-flex rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            Return to upload workspace
          </Link>
        </motion.div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {/* Title block */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
              Interactive Data Explorer
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Data Table</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Query, sort, filter, and selectively display columns from the raw dataset. All operations run server-side for high performance.
            </p>
          </div>

          {data && (
            <div className="flex shrink-0 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-center text-xs shadow-md">
                <p className="text-slate-400 uppercase tracking-widest">Matched Rows</p>
                <p className="mt-1 text-lg font-semibold text-sky-400">
                  {data.total_filtered.toLocaleString()} / {data.total_rows.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Query Controls bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Global search input */}
          <div className="relative min-w-[280px] max-w-md flex-1">
            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search across all columns..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 shadow-inner outline-none transition focus:border-sky-400/50 focus:bg-slate-900"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 right-4 flex items-center text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle filter panel button */}
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition',
              isFilterPanelOpen || Object.keys(filters).length > 0
                ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <span>⚙️</span>
            <span>Column Filters</span>
            {Object.keys(filters).length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-400 text-xs font-bold text-slate-950">
                {Object.keys(filters).length}
              </span>
            )}
          </button>

          {/* Column Selector Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColSelectorOpen(!isColSelectorOpen)}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition',
                isColSelectorOpen
                  ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <span>👁️</span>
              <span>Columns</span>
              {data && visibleColumns.size < data.headers.length && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
                  {visibleColumns.size}
                </span>
              )}
            </button>

            {/* Column Selector Dropdown */}
            <AnimatePresence>
              {isColSelectorOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsColSelectorOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 mt-2 z-20 w-64 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Select columns to display
                    </p>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {data?.headers.map((colName) => (
                        <label
                          key={colName}
                          className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer text-sm text-slate-200 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(colName)}
                            onChange={() => toggleColumnVisibility(colName)}
                            className="rounded border-white/20 bg-slate-800 text-sky-500 outline-none"
                          />
                          <span className="truncate">{colName}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="self-start rounded-full border border-rose-500/20 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 lg:self-auto"
          >
            Clear Filters & Sorting
          </button>
        )}
      </div>

      {/* Advanced Column Filters Panel */}
      <AnimatePresence>
        {isFilterPanelOpen && data && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span>⚙️</span> Column-Specific Filters
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {data.columns.map((col) => {
                  const isNumeric = col.type === 'Numeric'
                  const filterVal = filters[col.name]

                  return (
                    <div key={col.name} className="space-y-1.5 rounded-2xl border border-white/5 bg-slate-950/45 p-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-sky-300 truncate max-w-[70%]">{col.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{col.type}</span>
                      </div>
                      
                      {isNumeric ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filterVal?.min || ''}
                            onChange={(e) => handleColumnFilterChange(col.name, e.target.value, 'numeric-min')}
                            className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400/40"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filterVal?.max || ''}
                            onChange={(e) => handleColumnFilterChange(col.name, e.target.value, 'numeric-max')}
                            className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400/40"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Contains text..."
                          value={typeof filterVal === 'string' ? filterVal : ''}
                          onChange={(e) => handleColumnFilterChange(col.name, e.target.value, 'text')}
                          className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400/40"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table & Data Container */}
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-2xl overflow-hidden">
        {isLoading ? (
          // Shimmer loading skeleton
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 w-full animate-pulse rounded bg-white/10 animate-duration-1000" />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-t border-white/5 pt-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-10 w-full animate-pulse rounded bg-white/5 animate-duration-1000" />
                ))}
              </div>
            ))}
          </div>
        ) : data && data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] select-none">
                  {data.headers
                    .filter((colName) => visibleColumns.has(colName))
                    .map((colName) => {
                      const isSorted = sortBy === colName
                      return (
                        <th
                          key={colName}
                          onClick={() => handleSort(colName)}
                          className="cursor-pointer px-4 py-3.5 font-semibold text-slate-200 hover:bg-white/5 hover:text-white transition whitespace-nowrap group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{colName}</span>
                            <span className="text-xs transition text-slate-400 group-hover:text-sky-300">
                              {isSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                      )
                    })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, rIdx) => {
                  return (
                    <tr
                      key={rIdx}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition duration-150"
                    >
                      {data.headers.map((colName) => {
                        if (!visibleColumns.has(colName)) return null
                        
                        // Row cell lookup
                        const originalColIdx = data.headers.indexOf(colName)
                        const cellVal = row[originalColIdx]

                        return (
                          <td key={colName} className="px-4 py-3 text-slate-300 whitespace-nowrap max-w-xs truncate">
                            {cellVal === '' || cellVal === null || cellVal === undefined ? (
                              <span className="text-slate-600">—</span>
                            ) : (
                              String(cellVal)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Empty State
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center p-6">
            <div className="text-4xl text-slate-500">📂</div>
            <h3 className="text-lg font-semibold text-white">No records found</h3>
            <p className="max-w-md text-sm text-slate-400">
              No rows in the dataset match the active global search query or column-specific filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-400 transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.total_filtered > 0 && (
          <div className="border-t border-white/10 bg-slate-950/40 px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm select-none">
            {/* Left info label */}
            <div className="text-slate-400">
              Showing{' '}
              <span className="font-semibold text-white">
                {((page - 1) * limit + 1).toLocaleString()}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-white">
                {Math.min(page * limit, data.total_filtered).toLocaleString()}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-white">
                {data.total_filtered.toLocaleString()}
              </span>{' '}
              entries
              {data.total_filtered < data.total_rows && (
                <span>
                  {' '}
                  (filtered from{' '}
                  <span className="font-semibold text-slate-300">
                    {data.total_rows.toLocaleString()}
                  </span>{' '}
                  total)
                </span>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Limit items selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value))
                    setPage(1)
                  }}
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white focus:outline-none focus:border-sky-400/40"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-900/60 disabled:hover:text-slate-300 transition"
                >
                  ◀ Prev
                </button>

                {paginationRange.map((p, idx) => {
                  const isCurrent = p === page
                  const isEllipsis = p === '...'

                  if (isEllipsis) {
                    return (
                      <span key={`ell-${idx}`} className="px-2 text-slate-500">
                        ...
                      </span>
                    )
                  }

                  return (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setPage(Number(p))}
                      className={[
                        'h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition',
                        isCurrent
                          ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                          : 'border border-white/10 bg-slate-900/60 text-slate-300 hover:bg-slate-900 hover:text-white',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  )
                })}

                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-900/60 disabled:hover:text-slate-300 transition"
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
