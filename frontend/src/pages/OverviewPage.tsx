import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import * as echarts from 'echarts'

export function OverviewPage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')
  const chartRef = useRef<HTMLDivElement | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['dataset', fileId],
    queryFn: async () => {
      if (!fileId) return null
      const response = await axios.get(`http://localhost:8000/api/v1/datasets/${fileId}`)
      return response.data
    },
    enabled: !!fileId,
  })

  useEffect(() => {
    if (!chartRef.current || !data) {
      return undefined
    }

    const chart = echarts.init(chartRef.current)
    const columnNames = data.columns.map((c: any) => c.name)
    const uniqueCounts = data.columns.map((c: any) => c.unique_count)

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '3%', top: '10%', bottom: '10%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0]
          return `<div class="p-1"><span class="font-semibold text-slate-400">${item.name}</span><br/><span class="text-sky-300 font-bold">${item.value.toLocaleString()}</span> unique values</div>`
        },
      },
      xAxis: {
        type: 'category',
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.4)' } },
        axisLabel: {
          color: '#cbd5e1',
          rotate: columnNames.length > 8 ? 30 : 0,
          interval: 0,
        },
        data: columnNames,
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
        axisLabel: { color: '#cbd5e1' },
      },
      series: [
        {
          name: 'Unique Values',
          type: 'bar',
          barWidth: '40%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#2563eb' },
            ]),
            borderRadius: [8, 8, 0, 0],
          },
          data: uniqueCounts,
        },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
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
            Please upload an Excel or CSV spreadsheet on the upload page to generate dataset overview
            dashboards and uncover business insights.
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
        <p className="text-sm font-medium tracking-wide text-slate-300">Loading dataset profile...</p>
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
          <h1 className="mt-6 text-3xl font-semibold text-white">Failed to profile dataset</h1>
          <p className="mt-4 text-sm leading-7 text-rose-200">
            {error instanceof Error ? error.message : 'An error occurred while loading metadata.'}
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

  const metricCards = [
    { label: 'Total rows', value: data.total_rows.toLocaleString() },
    { label: 'Total columns', value: data.total_columns.toLocaleString() },
    { label: 'Missing values', value: `${data.missing_percent}%` },
    { label: 'Duplicate rows', value: `${data.duplicate_percent}%` },
  ]

  const summaryCards = [
    { label: 'File name', value: data.filename },
    { label: 'File size', value: data.file_size ? `${(data.file_size / 1024).toFixed(1)} KB` : 'N/A' },
    { label: 'Memory size', value: data.memory_usage },
    { label: 'Numeric columns', value: data.numeric_columns_count },
    { label: 'Text columns', value: data.text_columns_count },
    { label: 'Date columns', value: data.date_columns_count },
  ]

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
              Dataset overview
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Spreadsheet profile: {data.filename}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Your dataset was successfully uploaded and profiled. View the dimensions, missing
              records, duplicate rates, column schema, and a sneak peek of the data records below.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Parsing and profiling pipeline fully connected
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-lg shadow-black/10"
            >
              <p className="text-sm text-slate-400">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
          className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl xl:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-300">Data cardinality</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Unique values count per column</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
              ECharts
            </div>
          </div>

          <div ref={chartRef} className="mt-6 h-72 w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
        >
          <p className="text-sm font-medium text-slate-200">Dataset metadata summary</p>
          <div className="mt-5 space-y-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0 text-sm">
                <span className="text-slate-400">{card.label}</span>
                <span className="font-semibold text-slate-200 break-all pl-2 text-right">{card.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
        className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-sky-300">Data schema</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Columns profile</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
            Schema
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 font-semibold text-slate-200">Column Name</th>
                <th className="px-4 py-3 font-semibold text-slate-200">Data Type</th>
                <th className="px-4 py-3 font-semibold text-slate-200">Missing Values</th>
                <th className="px-4 py-3 font-semibold text-slate-200">Unique Values</th>
              </tr>
            </thead>
            <tbody>
              {data.columns.map((col: any) => (
                <tr key={col.name} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.01]">
                  <td className="px-4 py-3 font-medium text-white">{col.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        col.type === 'Numeric'
                          ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                          : col.type === 'Datetime'
                            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                            : 'bg-purple-400/10 text-purple-400 border border-purple-400/20'
                      }`}
                    >
                      {col.type} ({col.raw_type})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {col.missing_count > 0 ? (
                      <span className="text-amber-400">
                        {col.missing_count} ({col.missing_percent}%)
                      </span>
                    ) : (
                      <span className="text-slate-500">0 (0%)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{col.unique_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.2 }}
        className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-sky-300">Data preview</p>
            <h2 className="mt-1 text-xl font-semibold text-white">First 10 records</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
            Preview
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {data.preview_headers.map((hdr: string) => (
                  <th key={hdr} className="px-4 py-3 font-semibold text-slate-200 whitespace-nowrap">
                    {hdr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.preview_rows.map((row: string[], rIdx: number) => (
                <tr key={rIdx} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.01]">
                  {row.map((cell: string, cIdx: number) => (
                    <td key={cIdx} className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {cell === '' ? <span className="text-slate-600">—</span> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </section>
  )
}