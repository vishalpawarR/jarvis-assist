import Link from "next/link";
import { signOut } from "@/features/auth";
import { getPersonalDetails } from "@/features/personal-details/data";
import { PersonalDetailsForm } from "@/features/personal-details/personal-details-form";
import { getSavedPages } from "@/features/saved-pages/data";
import { PageManager } from "@/features/saved-pages/page-manager";
import { getTrackedSites } from "@/features/tracked-sites/data";
import { SiteManager } from "@/features/tracked-sites/site-manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ feature?: string; result?: string; error?: string }>;
};

function SetupRequired() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link className="brand-link" href="/">
        <span className="brand-icon">J</span> Jarvis
      </Link>
      <section className="feature-card mt-12">
        <p className="eyebrow">One-time setup</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Connect your Supabase project
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          The website is ready, but account and data storage are disabled until you add your own
          Supabase credentials and apply the database migration.
        </p>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
          <li>Create a free Supabase project and copy its project URL and publishable key.</li>
          <li>
            Copy <code>web/.env.example</code> to <code>web/.env.local</code> and fill in the
            values.
          </li>
          <li>
            Apply <code>supabase/migrations/202611110001_initial_jarvis_data.sql</code> in the
            Supabase SQL Editor.
          </li>
          <li>
            Set the local app URL in Supabase Auth URL Configuration to{" "}
            <code>http://localhost:3000</code>.
          </li>
        </ol>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="button-primary" href="/login">
            Sign in
          </Link>
          <Link className="button-secondary" href="/signup">
            Create an account
          </Link>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Keep the publishable key in local environment configuration. Never use a service-role key
          in this website.
        </p>
      </section>
    </main>
  );
}

function ResultMessage({ result, feature, error }: Awaited<Props["searchParams"]>) {
  if (error === "signout") {
    return (
      <p className="form-error" role="alert">
        Could not complete sign-out. Please try again.
      </p>
    );
  }
  if (result === "error") {
    return (
      <p className="form-error" role="alert">
        Could not save that change. Check the form and confirm the Supabase migration has been
        applied.
      </p>
    );
  }
  if (result !== "saved" && result !== "deleted") return null;
  const label =
    feature === "sites" ? "Website" : feature === "pages" ? "Saved page" : "Personal details";
  return (
    <p className="form-notice" role="status">
      {label} {result === "saved" ? "saved." : "removed."}
    </p>
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const supabase = await createClient();
  const [sitesResult, pagesResult, detailsResult, params] = await Promise.all([
    getTrackedSites(supabase),
    getSavedPages(supabase),
    getPersonalDetails(supabase),
    searchParams,
  ]);
  const dataError = sitesResult.error || pagesResult.error || detailsResult.error;
  if (dataError) console.error("Jarvis could not load dashboard data.", dataError);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-7 sm:px-8">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5">
        <Link className="brand-link" href="/">
          <span className="brand-icon">J</span> Jarvis
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <a className="nav-link" href="#personal-details">
            My details
          </a>
          <a className="nav-link" href="#job-sites">
            Job sites
          </a>
          <a className="nav-link" href="#saved-pages">
            Saved pages
          </a>
          <form action={signOut}>
            <button className="button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <section className="py-9">
        <p className="eyebrow">Your workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Job search dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage your personal details, tracked career sites, and saved reading list. Changes are
          stored in your account; extension sync is not enabled yet.
        </p>
        <div className="mt-5">
          <ResultMessage {...params} />
          {dataError && (
            <p className="form-error mt-3" role="alert">
              Could not load your data. Confirm the database migration is applied and your Supabase
              project is reachable.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6">
        <section className="feature-card" id="personal-details">
          <div className="section-title mb-5">
            <div>
              <p className="eyebrow">Your profile</p>
              <h2>Personal details</h2>
            </div>
          </div>
          <PersonalDetailsForm details={detailsResult.data?.details ?? null} />
        </section>
        <SiteManager sites={sitesResult.data ?? []} />
        <PageManager pages={pagesResult.data ?? []} />
      </div>
      <footer className="py-8 text-center text-xs text-slate-500">
        Your account data is protected by Supabase Row Level Security. Resume files remain local.
      </footer>
    </main>
  );
}
