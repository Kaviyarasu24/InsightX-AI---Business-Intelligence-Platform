import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import * as echarts from 'echarts'

type KPICard = {
  label: string
  value: string
  change: string
  isPositive: boolean
}

type ChartItem = {
  name: string
  value: number
}

type TreemapItem = {
  name: string
  value?: number
  children?: TreemapItem[]
}

type HeatmapData = {
  x_axis?: string[]
  y_axis?: string[]
  values?: [number, number, number][]
}

type DashboardResponse = {
  kpis: KPICard[]
  charts: {
    line: ChartItem[]
    bar: ChartItem[]
    pie: ChartItem[]
    scatter: number[][]
    histogram: { range: string; count: number }[]
    treemap: TreemapItem[]
    heatmap: HeatmapData
  }
  filter_options: Record<string, string[]>
  primary_metric: string
  secondary_metric: string
  is_primary_currency: boolean
  is_secondary_currency: boolean
  is_fallback: boolean
  error_message: string
}

// Reusable ECharts Component
interface EChartProps {
  option: echarts.EChartsOption
  className?: string
}

function EChart({ option, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clean up previous instance if exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose()
    }

    const chart = echarts.init(containerRef.current)
    chartInstanceRef.current = chart
    chart.setOption(option)

    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [option])

  return <div ref={containerRef} className={className} />
}

// Main Dashboard Page
export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')

  // Filter dropdown state
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Fetch Dashboard analytics data
  const { data, isLoading, error } = useQuery<DashboardResponse | null>({
    queryKey: ['dataset-dashboard', fileId, JSON.stringify(activeFilters)],
    queryFn: async () => {
      if (!fileId) return null
      const response = await axios.get(`http://localhost:8000/api/v1/datasets/${fileId}/dashboard`, {
        params: {
          filters: Object.keys(activeFilters).length > 0 ? JSON.stringify(activeFilters) : undefined,
        },
      })
      return response.data
    },
    enabled: !!fileId,
  })

  // Clear filters
  const clearAllFilters = () => {
    setActiveFilters({})
    setOpenDropdown(null)
  }

  // Toggle dynamic category selection in filters
  const handleFilterToggle = (colName: string, val: string) => {
    setActiveFilters((prev) => {
      const current = prev[colName] || []
      let next: string[]
      if (current.includes(val)) {
        next = current.filter((item) => item !== val)
      } else {
        next = [...current, val]
      }

      const updated = { ...prev, [colName]: next }
      if (next.length === 0) {
        delete updated[colName]
      }
      return updated
    })
  }

  // Visual options memoization
  const lineOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.line) return {}
    const xData = data.charts.line.map((item) => item.name)
    const yData = data.charts.line.map((item) => item.value)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(56, 189, 248, 0.4)' } },
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      series: [
        {
          data: yData,
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#38bdf8' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(56, 189, 248, 0.22)' },
              { offset: 1, color: 'rgba(56, 189, 248, 0)' },
            ]),
          },
        },
      ],
    }
  }, [data])

  const pieOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.pie) return {}
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '75%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: data.charts.pie.map((item) => ({
            ...item,
            itemStyle: {
              color:
                item.name === 'N/A'
                  ? '#475569'
                  : undefined,
            },
          })),
        },
      ],
    }
  }, [data])

  const barOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.bar) return {}
    const xData = data.charts.bar.map((item) => item.name)
    const yData = data.charts.bar.map((item) => item.value)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.12)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          rotate: xData.length > 5 ? 25 : 0,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      series: [
        {
          data: yData,
          type: 'bar',
          barWidth: '40%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#047857' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [data])

  const scatterOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.scatter) return {}
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          return `<div class="p-1"><span class="font-semibold text-slate-400">Record Correlation</span><br/>${data.primary_metric}: <span class="font-bold text-sky-400">${params.value[0].toLocaleString()}</span><br/>${data.secondary_metric}: <span class="font-bold text-amber-400">${params.value[1].toLocaleString()}</span></div>`
        },
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      series: [
        {
          data: data.charts.scatter,
          type: 'scatter',
          symbolSize: 7,
          itemStyle: {
            color: '#f59e0b',
            opacity: 0.65,
          },
        },
      ],
    }
  }, [data])

  const histOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.histogram) return {}
    const xData = data.charts.histogram.map((item) => item.range)
    const yData = data.charts.histogram.map((item) => item.count)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 18 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      series: [
        {
          data: yData,
          type: 'bar',
          barWidth: '70%',
          itemStyle: {
            color: '#c084fc',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  }, [data])

  const treemapOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.treemap) return {}
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          type: 'treemap',
          data: data.charts.treemap,
          leafDepth: 1,
          visibleMinArea: 300,
          breadcrumb: { show: false },
          label: { show: true, formatter: '{b}', color: '#fff', fontSize: 11 },
          itemStyle: {
            borderColor: 'rgba(15, 23, 42, 0.5)',
            borderWidth: 2,
            gapWidth: 1,
          },
        },
      ],
    }
  }, [data])

  const heatmapOption = useMemo<echarts.EChartsOption>(() => {
    if (!data?.charts?.heatmap || !data.charts.heatmap.x_axis || !data.charts.heatmap.y_axis || !data.charts.heatmap.values) return {}
    const { x_axis, y_axis, values } = data.charts.heatmap
    const maxVal = values.length > 0 ? Math.max(...values.map((v) => v[2])) : 1

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const prefix = data.is_primary_currency ? '$' : ''
          return `<div class="p-1"><span class="font-semibold text-slate-400">Breakdown Pivot</span><br/>Col: <span class="font-semibold text-white">${x_axis[params.value[0]]}</span><br/>Row: <span class="font-semibold text-white">${y_axis[params.value[1]]}</span><br/>Avg Value: <span class="font-bold text-sky-400">${prefix}${params.value[2].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`
        },
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '20%', containLabel: true },
      xAxis: {
        type: 'category',
        data: x_axis,
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(0,0,0,0.01)'] } },
        axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 20 },
      },
      yAxis: {
        type: 'category',
        data: y_axis,
        splitArea: { show: true },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        itemHeight: 12,
        itemWidth: 140,
        textStyle: { color: '#94a3b8', fontSize: 10 },
        inRange: {
          color: [
            'rgba(37, 99, 235, 0.05)',
            'rgba(37, 99, 235, 0.45)',
            'rgba(37, 99, 235, 0.95)',
          ],
        },
      },
      series: [
        {
          name: 'Pivot Heatmap',
          type: 'heatmap',
          data: values,
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    }
  }, [data])

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
            Please upload an Excel or CSV spreadsheet on the upload page to view the dashboards.
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton Loading */}
        <div className="h-40 animate-pulse rounded-[2rem] bg-white/[0.06]" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="h-80 animate-pulse rounded-[2rem] bg-white/[0.04] xl:col-span-2" />
          <div className="h-80 animate-pulse rounded-[2rem] bg-white/[0.04]" />
        </div>
      </div>
    )
  }

  if (error || !data) {
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
          <h1 className="mt-6 text-3xl font-semibold text-white">Failed to generate dashboard</h1>
          <p className="mt-4 text-sm leading-7 text-rose-200">
            {error instanceof Error ? error.message : 'An error occurred while loading dashboard metrics.'}
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
      {/* Title bar and filters */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
              Operational Insights
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Visual Dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Interactive KPI metrics and visual aggregates powered by Apache ECharts. Select categories below to slice the dashboard dynamically.
            </p>
          </div>

          {/* Dynamic Filter Controls */}
          {Object.keys(data.filter_options).length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(data.filter_options).map(([colName, options]) => {
                const isActive = activeFilters[colName] && activeFilters[colName].length > 0
                const isDropdownOpen = openDropdown === colName

                return (
                  <div key={colName} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : colName)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition',
                        isActive
                          ? 'border-sky-400/40 bg-sky-400/15 text-sky-300'
                          : 'border-white/10 bg-slate-900/60 text-slate-300 hover:bg-slate-900',
                      ].join(' ')}
                    >
                      <span>{colName}</span>
                      {isActive && (
                        <span className="rounded-full bg-sky-400 px-2 py-0.5 text-[9px] font-bold text-slate-950">
                          {activeFilters[colName].length}
                        </span>
                      )}
                      <span>▼</span>
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setOpenDropdown(null)} />
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute right-0 mt-2 z-30 w-56 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-2xl"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2">
                              Filter by {colName}
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {options.map((val) => {
                                const isChecked = activeFilters[colName]?.includes(val) || false
                                return (
                                  <label
                                    key={val}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer text-xs text-slate-200 select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleFilterToggle(colName, val)}
                                      className="rounded border-white/20 bg-slate-800 text-sky-500 outline-none"
                                    />
                                    <span className="truncate">{val}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}

              {Object.keys(activeFilters).length > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {data.is_fallback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-slate-200"
        >
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-white">AI Schema Mapping Offline (Using Local Fallback)</p>
              <p className="mt-1 text-slate-300">
                The OpenRouter API call encountered an issue: <span className="font-semibold text-rose-300">{data.error_message}</span>.
                We have generated a fallback operational dashboard using localized rules. Please check your backend configurations.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {data.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md hover:border-white/25 hover:bg-slate-900/80 transition duration-200"
          >
            <p className="text-xs uppercase tracking-widest text-slate-400 truncate">{kpi.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white truncate">{kpi.value}</p>
            <p
              className={[
                'mt-2 text-xs font-medium truncate',
                kpi.isPositive ? 'text-emerald-400' : 'text-slate-400',
              ].join(' ')}
            >
              {kpi.change}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Charts Layout Grid */}
      <div className="space-y-6">
        {/* Row 1: Line and Donut */}
        <div className="grid gap-6 xl:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl xl:col-span-2"
          >
            <h3 className="text-base font-semibold text-white">Trend over Time ({data.primary_metric})</h3>
            <p className="text-xs text-slate-400">Sum of {data.primary_metric} across chronological slices.</p>
            <EChart option={lineOption} className="mt-4 h-72 w-full" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h3 className="text-base font-semibold text-white">Share Breakdown ({data.primary_metric})</h3>
            <p className="text-xs text-slate-400">Distribution share of {data.primary_metric} by category.</p>
            {data.charts.pie.length > 0 ? (
              <EChart option={pieOption} className="mt-4 h-72 w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-xs text-slate-500">No category breakdown available</div>
            )}
          </motion.div>
        </div>

        {/* Row 2: Bar and Heatmap */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h3 className="text-base font-semibold text-white">Categorical Comparison ({data.primary_metric})</h3>
            <p className="text-xs text-slate-400">Total sum breakdown of {data.primary_metric} sorted from highest to lowest.</p>
            {data.charts.bar.length > 0 ? (
              <EChart option={barOption} className="mt-4 h-72 w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-xs text-slate-500">No comparison data available</div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h3 className="text-base font-semibold text-white">Cross-Category Heatmap ({data.primary_metric})</h3>
            <p className="text-xs text-slate-400">Average {data.primary_metric} distribution across two distinct categories.</p>
            {data.charts.heatmap?.x_axis ? (
              <EChart option={heatmapOption} className="mt-4 h-72 w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-xs text-slate-500">Requires multiple categorical columns</div>
            )}
          </motion.div>
        </div>

        {/* Row 3: Scatter and Histogram */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h3 className="text-base font-semibold text-white">Metric Correlation (Scatter)</h3>
            <p className="text-xs text-slate-400">Relationship between primary metric {data.primary_metric} (X) and secondary metric {data.secondary_metric || 'Count'} (Y).</p>
            {data.charts.scatter.length > 0 ? (
              <EChart option={scatterOption} className="mt-4 h-72 w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-xs text-slate-500">Requires multiple numeric columns</div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h3 className="text-base font-semibold text-white">Value Distribution ({data.primary_metric})</h3>
            <p className="text-xs text-slate-400">Frequency counts of the primary metric {data.primary_metric} across numeric bins.</p>
            {data.charts.histogram.length > 0 ? (
              <EChart option={histOption} className="mt-4 h-72 w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-xs text-slate-500">Distribution analysis unavailable</div>
            )}
          </motion.div>
        </div>

        {/* Row 4: Treemap */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22 }}
          className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl"
        >
          <h3 className="text-base font-semibold text-white">Hierarchical Breakdown ({data.primary_metric})</h3>
          <p className="text-xs text-slate-400">Hierarchical category breakdown based on nested {data.primary_metric} volume totals.</p>
          {data.charts.treemap.length > 0 ? (
            <EChart option={treemapOption} className="mt-4 h-96 w-full" />
          ) : (
            <div className="flex h-96 items-center justify-center text-xs text-slate-500">No hierarchical data available</div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
