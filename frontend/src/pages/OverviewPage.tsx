import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import * as echarts from 'echarts'

const metricCards = [
  { label: 'Total rows', value: '128K' },
  { label: 'Total columns', value: '24' },
  { label: 'Missing values', value: '1.8%' },
  { label: 'Duplicate rows', value: '0.3%' },
]

export function OverviewPage() {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current) {
      return undefined
    }

    const chart = echarts.init(chartRef.current)

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 0, right: 0, top: 12, bottom: 0, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.4)' } },
        axisLabel: { color: '#cbd5e1' },
        data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
        axisLabel: { color: '#cbd5e1' },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          smooth: true,
          symbolSize: 10,
          lineStyle: { width: 4, color: '#38bdf8' },
          areaStyle: { color: 'rgba(56, 189, 248, 0.16)' },
          itemStyle: { color: '#60a5fa' },
          data: [24, 38, 32, 51, 64, 72],
        },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [])

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
            <p className="text-sm font-medium text-sky-300">Dataset overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Data profile at a glance</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              This foundation is ready for dataset profiling, KPI rendering, and richer analysis
              once the upload pipeline is connected.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Tailwind, router, query client, and charts configured
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

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
        className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-sky-300">Sample trend</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Revenue movement</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
            ECharts
          </div>
        </div>

        <div ref={chartRef} className="mt-6 h-72 w-full" />
      </motion.div>
    </section>
  )
}