import Link from "next/link";
import { redirectIfAuthenticated } from "@/features/auth/redirect-if-authenticated";

const features = [
  ["Personal details", "Keep reusable application information in one private profile."],
  ["Job sites", "Track career pages and maintain a focused list of opportunities."],
  ["Saved pages", "Organize reading into a short-term queue or a keep-forever library."],
];

export default async function Home() {
  await redirectIfAuthenticated();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8">
      <header className="flex items-center gap-3">
        <Link className="brand-link" href="/">
          <span className="brand-icon">J</span> Jarvis
        </Link>
        <nav className="ml-auto flex items-center gap-3">
          <Link className="button-secondary" href="/login">
            Sign in
          </Link>
          <Link className="button-primary" href="/signup">
            Create account
          </Link>
        </nav>
      </header>

      <section className="grid gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="eyebrow">A thoughtful job-search companion</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
            Keep the details of your search in one calm place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Jarvis Web brings your career sites, saved reading, and application details into a
            private workspace—alongside the browser extension.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href="/signup">
              Get started
            </Link>
            <a className="button-secondary" href="#features">
              Explore features
            </a>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.35)]">
          <p className="eyebrow">Your workspace</p>
          <div className="mt-5 space-y-3">
            {features.map(([title, description], index) => (
              <div className="flex gap-4 rounded-2xl bg-slate-50 p-4" key={title}>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-indigo-100 text-sm font-semibold text-indigo-800">
                  0{index + 1}
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 border-t border-slate-200 py-10 sm:grid-cols-3" id="features">
        {features.map(([title, description]) => (
          <article className="py-2" key={title}>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </section>

      <section
        className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 sm:p-8"
        id="setup"
      >
        <p className="eyebrow">Private by design</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Your account is yours alone.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          The website uses Supabase authentication and row-level security. Extension data remains on
          your device unless you explicitly opt into sync; that sync flow is a separate step and is
          not active yet.
        </p>
        <p className="mt-4 text-xs leading-5 text-slate-600">
          The app requires a configured Supabase project before account creation or cloud storage
          works. Project setup is documented in <code>web/README.md</code>.
        </p>
      </section>

      <footer className="mt-auto border-t border-slate-200 pt-6 text-xs text-slate-500">
        Jarvis Web · Built alongside the Jarvis browser extension.
      </footer>
    </main>
  );
}
