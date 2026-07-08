import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 text-center">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.35em] text-sky-300">Not found</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">This page does not exist.</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Go back to the upload workspace to continue building the InsightX AI pipeline.
        </p>
        <Link
          to="/upload"
          className="mt-6 inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          Back to upload
        </Link>
      </div>
    </section>
  )
}