import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'

type Insight = {
  title: string
  text: string
  type: 'Success' | 'Warning' | 'Info'
  impact: 'High' | 'Medium' | 'Low'
}

export function InsightsPage() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('fileId')
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Fetch insights
  const { data: insights, isLoading, error, refetch } = useQuery<Insight[]>({
    queryKey: ['insights', fileId],
    queryFn: async () => {
      if (!fileId) return []
      const res = await fetch(`http://localhost:8000/api/v1/datasets/${fileId}/insights`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to fetch insights')
      }
      return res.json()
    },
    enabled: !!fileId,
    retry: false,
  })

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      if (!fileId) return
      setIsRegenerating(true)
      const res = await fetch(`http://localhost:8000/api/v1/datasets/${fileId}/insights`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to clear insights cache')
      }
    },
    onSuccess: () => {
      refetch().finally(() => {
        setIsRegenerating(false)
      })
    },
    onError: () => {
      setIsRegenerating(false)
    }
  })

  const handleRegenerate = () => {
    clearCacheMutation.mutate()
  }

  // Loading skeleton rendering
  const renderSkeletons = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative animate-pulse overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/40 p-6 backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between">
            <div className="h-6 w-1/2 rounded bg-slate-800" />
            <div className="h-5 w-16 rounded-full bg-slate-800" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-slate-800" />
            <div className="h-4 w-5/6 rounded bg-slate-800" />
            <div className="h-4 w-4/5 rounded bg-slate-800" />
          </div>
          <div className="mt-6 flex gap-2">
            <div className="h-4 w-12 rounded bg-slate-800" />
            <div className="h-4 w-16 rounded bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )

  // Type-based style resolver
  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'Success':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/25',
          text: 'text-emerald-400',
          icon: (
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        }
      case 'Warning':
        return {
          bg: 'bg-rose-500/10 border-rose-500/25',
          text: 'text-rose-400',
          icon: (
            <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
        }
      case 'Info':
      default:
        return {
          bg: 'bg-sky-500/10 border-sky-500/25',
          text: 'text-sky-400',
          icon: (
            <svg className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
        }
    }
  }

  // Impact-based style resolver
  const getImpactStyles = (impact: Insight['impact']) => {
    switch (impact) {
      case 'High':
        return 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
      case 'Medium':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
      case 'Low':
      default:
        return 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
    }
  }

  if (!fileId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-slate-900/80 p-6 border border-white/5 shadow-2xl backdrop-blur-2xl">
          <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">No Dataset Selected</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">
          Please upload a spreadsheet first to analyze it and generate AI-driven business observations.
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
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">AI Business Insights</h2>
          <p className="mt-1 text-sm text-slate-400">
            Professional anomalies, highlights, and growth observations computed via LLM semantic profiling.
          </p>
        </div>

        {insights && insights.length > 0 && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || clearCacheMutation.isPending}
            className="flex items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-sky-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isRegenerating ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Regenerating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                </svg>
                Regenerate Insights
              </>
            )}
          </button>
        )}
      </div>

      {/* Error handling (e.g. Missing OpenRouter API Key) */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-2xl"
          >
            <svg className="mx-auto h-12 w-12 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-white">OpenRouter Setup Required</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-300">
              {error.message || 'An error occurred while generating insights.'}
            </p>
            <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/80 p-4 text-left font-mono text-xs text-slate-400">
              <p className="font-semibold text-slate-300"># To fix this, add to your backend/.env file:</p>
              <p className="mt-1 text-sky-300">OPENROUTER_API_KEY=your_actual_key_here</p>
            </div>
            <button
              onClick={() => refetch()}
              className="mt-6 rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-200 active:scale-95"
            >
              Retry Connection
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Shimmers */}
      {isLoading && renderSkeletons()}

      {/* Dynamic Insights Grid */}
      <AnimatePresence>
        {!isLoading && !error && insights && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.08 }
              }
            }}
            className="grid gap-6 md:grid-cols-2"
          >
            {insights.map((insight, idx) => {
              const styles = getTypeStyles(insight.type)
              return (
                <motion.div
                  key={idx}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                  }}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-[2rem] border p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/20 ${styles.bg}`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl border border-white/10 bg-white/5 p-2 shadow-inner`}>
                          {styles.icon}
                        </div>
                        <h4 className="text-base font-bold text-white leading-tight">{insight.title}</h4>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getImpactStyles(insight.impact)}`}>
                        {insight.impact} Impact
                      </span>
                    </div>

                    {/* Body */}
                    <p className="mt-4 text-sm leading-6 text-slate-300">{insight.text}</p>
                  </div>

                  {/* Footer metadata */}
                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}>
                      {insight.type}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Verified Observation</span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!isLoading && !error && insights && insights.length === 0 && (
        <div className="rounded-[2rem] border border-white/5 bg-slate-900/20 p-12 text-center backdrop-blur-xl">
          <p className="text-sm text-slate-400">No AI insights generated for this dataset.</p>
        </div>
      )}
    </section>
  )
}
