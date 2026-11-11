export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-indigo-600 font-bold text-white">
          J
        </div>
        <span className="text-lg font-semibold tracking-tight">Jarvis</span>
        <span className="ml-auto rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800">
          Web app foundation
        </span>
      </header>

      <section className="my-auto grid gap-10 py-20 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Your job search, in one place
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            A calmer home for your next opportunity.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Jarvis Web is the starting point for managing your job sites, saved pages, and personal
            details alongside the browser extension.
          </p>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900">Local-only starter</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The extension is unchanged. Sign-in, cloud storage, and sync are not connected yet; your
            existing extension data has not been uploaded.
          </p>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            Next step: set up Supabase authentication and a protected database before adding account
            or sync screens.
          </p>
        </aside>
      </section>

      <footer className="border-t border-slate-200 pt-5 text-sm text-slate-500">
        Built with Next.js. Planning and architecture decisions live in the shared repository docs.
      </footer>
    </main>
  );
}
