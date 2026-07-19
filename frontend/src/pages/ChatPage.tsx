import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import * as echarts from 'echarts'

type Message = {
  role: 'user' | 'assistant'
  content: string
  code?: string
  data?: any[]
  chart_type?: 'bar' | 'line' | 'pie' | 'scatter' | null
  chart_config?: {
    x_column: string
    y_column: string
    title: string
  } | null
  error?: string | null
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

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeCodeIndex, setActiveCodeIndex] = useState<number | null>(null)
  const [activeTableIndex, setActiveTableIndex] = useState<number | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const suggestions = [
    'Which region performs best?',
    'Show highest sales month',
    'Which products are underperforming?',
    'Create a chart for monthly sales',
    'Plot total profit by category',
    'Provide a statistical summary'
  ]

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || !fileId) return

    const userMessage: Message = {
      role: 'user',
      content: text
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Build chat history context
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))

    try {
      const res = await fetch(`http://localhost:8000/api/v1/datasets/${fileId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: text,
          history: history
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to get query answer')
      }

      const data = await res.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.explanation,
        code: data.code,
        data: data.data,
        chart_type: data.chart_type,
        chart_config: data.chart_config,
        error: data.error
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong while executing your query. Please verify your OpenRouter credentials.'}`,
        error: error.message
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Dynamic ECharts option generator
  const getChartOption = (msg: Message): echarts.EChartsOption => {
    if (!msg.data || !msg.chart_config || !msg.chart_type) return {}
    
    const { x_column, y_column, title } = msg.chart_config
    const chartData = msg.data

    const xVals = chartData.map((row) => String(row[x_column] ?? ''))
    const yVals = chartData.map((row) => {
      const val = row[y_column]
      return typeof val === 'number' ? val : parseFloat(val) || 0
    })

    const chartTitle = title || `${y_column} by ${x_column}`

    if (msg.chart_type === 'pie') {
      const pieData = chartData.map((row) => ({
        name: String(row[x_column] ?? ''),
        value: typeof row[y_column] === 'number' ? row[y_column] : parseFloat(row[y_column]) || 0
      }))

      return {
        backgroundColor: 'transparent',
        title: {
          text: chartTitle,
          textStyle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
          left: 'center',
          top: '3%'
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255,255,255,0.1)',
          textStyle: { color: '#fff' }
        },
        series: [
          {
            name: y_column,
            type: 'pie',
            radius: '55%',
            center: ['50%', '55%'],
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            label: {
              color: '#94a3b8',
              fontSize: 10
            }
          }
        ]
      }
    }

    if (msg.chart_type === 'scatter') {
      const scatterData = chartData.map((row) => [
        typeof row[x_column] === 'number' ? row[x_column] : parseFloat(row[x_column]) || 0,
        typeof row[y_column] === 'number' ? row[y_column] : parseFloat(row[y_column]) || 0
      ])

      return {
        backgroundColor: 'transparent',
        title: {
          text: chartTitle,
          textStyle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
          left: 'center',
          top: '3%'
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255,255,255,0.1)',
          textStyle: { color: '#fff' }
        },
        grid: { left: '3%', right: '5%', top: '15%', bottom: '8%', containLabel: true },
        xAxis: {
          type: 'value',
          name: x_column,
          nameTextStyle: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
          axisLabel: { color: '#94a3b8' }
        },
        yAxis: {
          type: 'value',
          name: y_column,
          nameTextStyle: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
          axisLabel: { color: '#94a3b8' }
        },
        series: [
          {
            type: 'scatter',
            symbolSize: 8,
            data: scatterData,
            itemStyle: { color: '#f59e0b', opacity: 0.85 }
          }
        ]
      }
    }

    // Default: Bar & Line
    return {
      backgroundColor: 'transparent',
      title: {
        text: chartTitle,
        textStyle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
        left: 'center',
        top: '3%'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' }
      },
      grid: { left: '3%', right: '5%', top: '18%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xVals,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.12)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          rotate: xVals.length > 6 ? 20 : 0
        }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 }
      },
      series: [
        {
          data: yVals,
          type: msg.chart_type === 'line' ? 'line' : 'bar',
          smooth: true,
          barWidth: '35%',
          itemStyle: {
            color: msg.chart_type === 'line' 
              ? '#38bdf8'
              : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#3b82f6' },
                  { offset: 1, color: '#1d4ed8' }
                ]),
            borderRadius: msg.chart_type === 'line' ? [0, 0, 0, 0] : [4, 4, 0, 0]
          },
          areaStyle: msg.chart_type === 'line' ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(56, 189, 248, 0.25)' },
              { offset: 1, color: 'rgba(56, 189, 248, 0)' }
            ])
          } : undefined
        }
      ]
    }
  }

  if (!fileId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-slate-900/80 p-6 border border-white/5 shadow-2xl backdrop-blur-2xl">
          <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">No Dataset Selected</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">
          Please upload a spreadsheet first to analyze and query it with natural language.
        </p>
        <Link
          to="/upload"
          className="mt-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-sky-500/20 hover:border-sky-400/50"
        >
          Go to Upload
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-[2.5rem] border border-white/5 bg-slate-900/15 backdrop-blur-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-2 shadow-inner">
            <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">InsightX AI Chat</h3>
            <p className="text-xs text-slate-400">Ask questions about your uploaded spreadsheet</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 rounded-full px-3 py-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ready to query
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
            <div>
              <div className="mx-auto h-16 w-16 items-center justify-center flex rounded-[1.8rem] border border-white/5 bg-slate-950/80 p-4 shadow-xl">
                <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="mt-4 text-lg font-bold text-white">Ask anything about your data</h4>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                Type queries such as "Plot quarterly profit" or "What's the category with the highest sales?". The AI will calculate the answer and generate live charts.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 w-full">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="text-left text-xs text-slate-300 hover:text-white border border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.05] transition-all p-3.5 rounded-2xl flex items-center justify-between group active:scale-[0.98]"
                >
                  <span>{s}</span>
                  <svg className="h-3.5 w-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] rounded-[2rem] px-5 py-4 border shadow-2xl ${
                    msg.role === 'user'
                      ? 'bg-sky-500/10 border-sky-400/20 text-white rounded-br-md'
                      : 'bg-slate-900/60 border-white/5 text-slate-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-6 whitespace-pre-wrap">{msg.content}</p>

                  {/* Render error info if exists */}
                  {msg.role === 'assistant' && msg.error && (
                    <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                      <p className="font-semibold">Query computation warning/error:</p>
                      <p className="mt-1 font-mono">{msg.error}</p>
                    </div>
                  )}

                  {/* Interactive Code & Data Options for Assistant Response */}
                  {msg.role === 'assistant' && (msg.code || (msg.data && msg.data.length > 0)) && (
                    <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap gap-2 text-xs">
                      {msg.code && (
                        <button
                          onClick={() => setActiveCodeIndex(activeCodeIndex === index ? null : index)}
                          className={`rounded-xl border px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                            activeCodeIndex === index
                              ? 'border-sky-400 bg-sky-500/20 text-white'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          {activeCodeIndex === index ? 'Hide Code' : 'View Pandas Code'}
                        </button>
                      )}

                      {msg.data && msg.data.length > 0 && (
                        <button
                          onClick={() => setActiveTableIndex(activeTableIndex === index ? null : index)}
                          className={`rounded-xl border px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                            activeTableIndex === index
                              ? 'border-emerald-400 bg-emerald-500/20 text-white'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {activeTableIndex === index ? 'Hide Table' : 'View Data Table'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-panels for Code & Data (rendered outside bubble to keep layout clean) */}
                <AnimatePresence>
                  {msg.role === 'assistant' && activeCodeIndex === index && msg.code && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 w-full max-w-[85%] rounded-[1.8rem] border border-white/5 bg-slate-950 p-4 font-mono text-xs overflow-x-auto shadow-2xl text-slate-300"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        <span>Generated Pandas Execution Code</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.code || '')}
                          className="hover:text-white"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-sky-300">{msg.code}</pre>
                    </motion.div>
                  )}

                  {msg.role === 'assistant' && activeTableIndex === index && msg.data && msg.data.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 w-full max-w-[85%] rounded-[1.8rem] border border-white/5 bg-slate-950/70 p-4 shadow-2xl overflow-hidden"
                    >
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">
                        Query Output Subset ({msg.data.length} records)
                      </p>
                      <div className="max-h-60 overflow-auto rounded-xl border border-white/5">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-900 sticky top-0">
                            <tr>
                              {Object.keys(msg.data[0]).map((key) => (
                                <th key={key} className="px-4 py-2 border-b border-white/5 text-slate-300 font-bold">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.data.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-white/[0.02]">
                                {Object.values(row).map((val: any, cIdx) => (
                                  <td key={cIdx} className="px-4 py-2 border-b border-white/5 text-slate-400 whitespace-nowrap">
                                    {val === null || val === undefined ? '' : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {/* Inline Chart Rendering */}
                  {msg.role === 'assistant' && msg.chart_type && msg.chart_config && msg.data && msg.data.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 w-full max-w-[85%] rounded-[2rem] border border-white/5 bg-slate-900/35 p-5 shadow-2xl"
                    >
                      <EChart
                        option={getChartOption(msg)}
                        className="h-72 w-full"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex justify-start max-w-5xl mx-auto">
            <div className="rounded-[2rem] px-5 py-4 border border-white/5 bg-slate-900/60 shadow-2xl flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <div className="border-t border-white/5 bg-slate-900/30 px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(inputValue)
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your question about the dataset..."
            disabled={isLoading}
            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-sky-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            Send
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-2 9 2-9-18-9 18zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
