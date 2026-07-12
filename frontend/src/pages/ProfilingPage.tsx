import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import * as echarts from 'echarts'

type TabType = 'stats' | 'correlation' | 'quality'

export function ProfilingPage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')
  const [activeTab, setActiveTab] = useState<TabType>('stats')
  const [activeCol, setActiveCol] = useState<string>('')
  
  const colChartRef = useRef<HTMLDivElement | null>(null)
  const corrChartRef = useRef<HTMLDivElement | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['dataset-profiling', fileId],
    queryFn: async () => {
      if (!fileId) return null
      const response = await axios.get(`http://localhost:8000/api/v1/datasets/${fileId}/profiling`)
      return response.data
    },
    enabled: !!fileId,
  })

  const columnNames = data ? Object.keys(data.columns) : []

  // Initialize active column once data arrives
  useEffect(() => {
    if (columnNames.length > 0 && !activeCol) {
      setActiveCol(columnNames[0])
    }
  }, [columnNames, activeCol])

  // Column Distribution Chart
  useEffect(() => {
    if (activeTab !== 'stats' || !colChartRef.current || !data || !activeCol) {
      return undefined
    }

    const timer = setTimeout(() => {
      if (!colChartRef.current) return

      let chart = echarts.getInstanceByDom(colChartRef.current)
      if (chart) {
        chart.dispose()
      }
      chart = echarts.init(colChartRef.current)

      const colData = data.columns[activeCol]
      if (!colData || !colData.distribution) {
        return
      }

      const categories = colData.distribution.map((d: any) => d.range)
      const counts = colData.distribution.map((d: any) => d.count)
      const isNumeric = colData.type === 'Numeric'

      chart.setOption({
        backgroundColor: 'transparent',
        grid: { left: '3%', right: '3%', top: '10%', bottom: '15%', containLabel: true },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const item = params[0]
            return `<div class="p-1">
              <span class="font-semibold text-slate-400">${isNumeric ? 'Bin Range' : 'Category'}: ${item.name}</span><br/>
              <span class="text-sky-300 font-bold">${item.value.toLocaleString()}</span> occurrences
            </div>`
          }
        },
        xAxis: {
          type: 'category',
          axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.4)' } },
          axisLabel: {
            color: '#cbd5e1',
            rotate: categories.length > 6 ? 25 : 0,
            interval: 0,
          },
          data: categories,
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
          axisLabel: { color: '#cbd5e1' },
        },
        series: [
          {
            name: 'Count',
            type: 'bar',
            barMaxWidth: 45,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#38bdf8' },
                { offset: 1, color: '#4f46e5' },
              ]),
              borderRadius: [6, 6, 0, 0],
            },
            data: counts,
          },
        ],
      })

      const handleResize = () => chart.resize()
      window.addEventListener('resize', handleResize)
      
      // Cleanup resize listener inside the timer
      const originalDispose = chart.dispose
      chart.dispose = () => {
        window.removeEventListener('resize', handleResize)
        originalDispose.call(chart)
      }
    }, 120)

    return () => {
      clearTimeout(timer)
      if (colChartRef.current) {
        const chart = echarts.getInstanceByDom(colChartRef.current)
        if (chart) {
          chart.dispose()
        }
      }
    }
  }, [data, activeCol, activeTab])

  // Correlation Matrix Heatmap
  useEffect(() => {
    if (activeTab !== 'correlation' || !corrChartRef.current || !data) {
      return undefined
    }

    const timer = setTimeout(() => {
      if (!corrChartRef.current) return

      let chart = echarts.getInstanceByDom(corrChartRef.current)
      if (chart) {
        chart.dispose()
      }
      chart = echarts.init(corrChartRef.current)

      const correlation = data.correlation
      if (!correlation || !correlation.columns || correlation.columns.length === 0) {
        chart.setOption({
          title: {
            text: 'No correlation matrix available (requires at least 2 numerical columns)',
            left: 'center',
            top: 'center',
            textStyle: { color: '#94a3b8', fontSize: 14 }
          }
        })
        return
      }

      const columns = correlation.columns
      const values = correlation.values

      const heatmapData: any[] = []
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const val = parseFloat(values[r][c].toFixed(3))
          heatmapData.push([c, r, val])
        }
      }

      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          position: 'top',
          formatter: (params: any) => {
            const colX = columns[params.data[0]]
            const colY = columns[params.data[1]]
            const val = params.data[2]
            return `<div class="p-2 text-xs">
              <span class="text-slate-400 font-semibold">${colX}</span> vs <span class="text-slate-400 font-semibold">${colY}</span><br/>
              Correlation: <span class="font-bold ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-slate-200'}">${val}</span>
            </div>`
          }
        },
        grid: { left: '10%', right: '5%', top: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: columns,
          axisLabel: { color: '#cbd5e1', rotate: columns.length > 6 ? 20 : 0 },
          splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(0,0,0,0.05)'] } }
        },
        yAxis: {
          type: 'category',
          data: columns,
          axisLabel: { color: '#cbd5e1' },
          splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(0,0,0,0.05)'] } }
        },
        visualMap: {
          min: -1,
          max: 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '0%',
          inRange: {
            color: ['#f43f5e', '#1e293b', '#10b981']
          },
          textStyle: { color: '#94a3b8' }
        },
        series: [
          {
            name: 'Correlation',
            type: 'heatmap',
            data: heatmapData,
            label: {
              show: true,
              color: '#ffffff',
              formatter: (params: any) => params.data[2]
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0,0,0,0.5)'
              }
            }
          }
        ]
      })

      const handleResize = () => chart.resize()
      window.addEventListener('resize', handleResize)

      const originalDispose = chart.dispose
      chart.dispose = () => {
        window.removeEventListener('resize', handleResize)
        originalDispose.call(chart)
      }
    }, 120)

    return () => {
      clearTimeout(timer)
      if (corrChartRef.current) {
        const chart = echarts.getInstanceByDom(corrChartRef.current)
        if (chart) {
          chart.dispose()
        }
      }
    }
  }, [data, activeTab])

  if (!fileId) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-10"
        >
          <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
            No active dataset
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Select a dataset to profile</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Please upload an Excel or CSV spreadsheet on the upload page first. Once uploaded, you
            can generate advanced statistical profiles and quality alerts.
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-400 border-t-transparent"></div>
        <p className="text-sm font-medium tracking-wide text-slate-300">Generating statistical profiles...</p>
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
            Profile failed
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Failed to profile dataset</h1>
          <p className="mt-4 text-sm leading-7 text-rose-200">
            {error instanceof Error ? error.message : 'An error occurred while generating statistics.'}
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

  const selectedColData = data.columns[activeCol]

  return (
    <section className="space-y-6">
      {/* Profiling Title Dashboard Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
              Data Profiler
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Advanced profiling: {data.filename}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Examine distribution curves, data cardinalities, mathematical correlation matrixes,
              and data quality warning alerts inside your uploaded dataset.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-200">
            Total dimensions: <span className="font-bold text-white">{data.total_rows.toLocaleString()}</span> rows × <span className="font-bold text-white">{data.total_columns}</span> columns
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mt-8 flex flex-wrap border-b border-white/10 gap-2">
          {(['stats', 'correlation', 'quality'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all capitalize duration-200 ${
                activeTab === tab
                  ? 'border-sky-400 text-sky-200 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'stats' ? 'Column statistics' : tab === 'correlation' ? 'Correlation matrix' : 'Data quality warnings'}
              {tab === 'quality' && data.warnings.length > 0 && (
                <span className="ml-2 rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-xs text-rose-300 font-bold">
                  {data.warnings.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main Profiler Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid gap-6 xl:grid-cols-4"
          >
            {/* Sidebar Column Selection List */}
            <div className="rounded-[2.2rem] border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur-xl max-h-[75vh] overflow-y-auto">
              <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select column
              </p>
              <div className="space-y-1">
                {columnNames.map((col) => {
                  const info = data.columns[col]
                  return (
                    <button
                      key={col}
                      onClick={() => setActiveCol(col)}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${
                        activeCol === col
                          ? 'bg-sky-400/10 text-white border border-sky-400/20 shadow-inner'
                          : 'text-slate-300 hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      <span className="truncate pr-2">{col}</span>
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                          info.type === 'Numeric'
                            ? 'bg-blue-400/10 text-blue-300 border-blue-400/25'
                            : info.type === 'Datetime'
                              ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25'
                              : 'bg-purple-400/10 text-purple-300 border-purple-400/25'
                        }`}
                      >
                        {info.type === 'Numeric' ? 'Num' : info.type === 'Datetime' ? 'Date' : 'Txt'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Column Profile Dashboard */}
            <div className="xl:col-span-3 space-y-6">
              {selectedColData && (
                <>
                  {/* Cards Row */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-lg">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Unique values</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {selectedColData.unique_count.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-lg">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Missing values</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {selectedColData.missing_count.toLocaleString()}{' '}
                        <span className="text-sm font-medium text-slate-400">
                          ({selectedColData.missing_percent}%)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-lg">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Column type</p>
                      <p className="mt-3 text-3xl font-semibold text-sky-300">
                        {selectedColData.type}
                      </p>
                    </div>
                  </div>

                  {/* Distribution Chart & Statistics Details */}
                  <div className="grid gap-6 xl:grid-cols-3">
                    {/* ECharts bar chart */}
                    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-2xl xl:col-span-2">
                      <p className="text-sm font-semibold text-slate-200">
                        {selectedColData.type === 'Numeric' ? 'Frequency distribution (Histogram)' : 'Value frequency top categories'}
                      </p>
                      <div ref={colChartRef} className="mt-6 h-80 w-full" />
                    </div>

                    {/* Numeric Mathematical stats summaries */}
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-2xl">
                      <p className="text-sm font-semibold text-slate-200">Mathematical profiling</p>
                      <div className="mt-5 space-y-3.5 text-sm">
                        {selectedColData.type === 'Numeric' && selectedColData.stats ? (
                          <>
                            {[
                              { label: 'Mean', value: selectedColData.stats.mean.toLocaleString() },
                              { label: 'Median', value: selectedColData.stats.median.toLocaleString() },
                              { label: 'Std deviation', value: selectedColData.stats.std.toLocaleString() },
                              { label: 'Min value', value: selectedColData.stats.min.toLocaleString() },
                              { label: 'Max value', value: selectedColData.stats.max.toLocaleString() },
                              { label: '25th Percentile (Q1)', value: selectedColData.stats.q25.toLocaleString() },
                              { label: '75th Percentile (Q3)', value: selectedColData.stats.q75.toLocaleString() },
                              { label: 'Skewness', value: selectedColData.stats.skew.toFixed(3) },
                              { label: 'Kurtosis', value: selectedColData.stats.kurtosis.toFixed(3) },
                            ].map((stat) => (
                              <div
                                key={stat.label}
                                className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="text-slate-400">{stat.label}</span>
                                <span className="font-semibold text-slate-200">{stat.value}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="flex h-64 flex-col items-center justify-center text-center text-slate-400">
                            <span className="text-2xl mb-2">📊</span>
                            Numerical profiling is only available for Numeric type columns.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'correlation' && (
          <motion.div
            key="correlation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.5rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Pearson correlation matrix heatmap</h2>
              <p className="mt-1 text-sm text-slate-400">
                Visualizes linear correlation between numeric columns. Value scales from -1 (fully negative) to +1 (fully positive correlation).
              </p>
            </div>
            <div className="flex justify-center">
              <div ref={corrChartRef} className="h-[550px] w-full max-w-[850px]" />
            </div>
          </motion.div>
        )}

        {activeTab === 'quality' && (
          <motion.div
            key="quality"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {data.warnings.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-12 text-center shadow-lg">
                <span className="text-4xl">✨</span>
                <h2 className="mt-4 text-xl font-semibold text-white">No data anomalies found!</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Your dataset has clean dimensions, no highly skewed numerical distributions, and
                  no columns with excessively high missing rates.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.warnings.map((warn: any, idx: number) => (
                  <div
                    key={idx}
                    className={`rounded-3xl border p-5 shadow-lg transition duration-200 hover:scale-[1.01] ${
                      warn.severity === 'High'
                        ? 'border-rose-500/25 bg-rose-500/5'
                        : warn.severity === 'Medium'
                          ? 'border-amber-500/25 bg-amber-500/5'
                          : 'border-slate-500/25 bg-slate-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          warn.severity === 'High'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : warn.severity === 'Medium'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}
                      >
                        ⚠️
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{warn.type}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                              warn.severity === 'High'
                                ? 'bg-rose-500/25 text-rose-300'
                                : warn.severity === 'Medium'
                                  ? 'bg-amber-500/25 text-amber-300'
                                  : 'bg-slate-500/25 text-slate-300'
                            }`}
                          >
                            {warn.severity} priority
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Column: {warn.column}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{warn.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
