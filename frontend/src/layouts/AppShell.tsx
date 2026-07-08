import { motion } from 'framer-motion'
import { NavLink, Outlet } from 'react-router-dom'

const navigationItems = [
  { label: 'Upload', to: '/upload' },
  { label: 'Overview', to: '/overview' },
]

export function AppShell() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_30%),radial-gradient(circle_at_right,_rgba(16,185,129,0.12),_transparent_28%)]" />

      <div className="relative flex min-h-screen flex-col xl:flex-row">
        <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-white/5 px-6 py-8 backdrop-blur-2xl xl:flex xl:flex-col">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300">
              InsightX AI
            </p>
            <h1 className="text-2xl font-semibold text-white">Enterprise BI Platform</h1>
            <p className="text-sm leading-6 text-slate-300">
              Upload files, profile datasets, and uncover business insights from one unified workspace.
            </p>
          </div>

          <nav className="mt-10 space-y-2">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }: { isActive: boolean }) =>
                  [
                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'border-sky-400/40 bg-sky-400/15 text-white shadow-lg shadow-sky-500/10'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')
                }
              >
                <span>{item.label}</span>
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Open
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
            <p className="text-sm font-medium text-white">Project status</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Step 2 is now wired. Next is the Upload page and file ingestion workflow.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300 xl:hidden">
                InsightX AI
              </p>
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Upload. Analyze. Discover.
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-lg shadow-black/10">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.75)]" />
              Ready for data ingestion
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}