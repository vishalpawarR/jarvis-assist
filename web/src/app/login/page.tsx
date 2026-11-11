import Link from "next/link";
import { AuthForm } from "@/features/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <Link className="brand-link" href="/">
        <span className="brand-icon">J</span> Jarvis
      </Link>
      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to Jarvis</h1>
        <p className="auth-description">Your job search workspace, private to your account.</p>
        {(error === "confirmation" || error === "session") && (
          <p className="form-error mb-4" role="alert">
            {error === "confirmation"
              ? "Email confirmation could not be completed. Request a new confirmation email or try signing in."
              : "Your session could not be verified. Please sign in again."}
          </p>
        )}
        {!configured && (
          <div className="setup-notice" role="status">
            Authentication is not connected yet. Follow the Supabase setup steps in{" "}
            <Link href="/#setup">the project guide</Link> before signing in.
          </div>
        )}
        <AuthForm mode="login" />
      </section>
      <p className="auth-footnote">
        Your extension data stays on this device unless you explicitly enable sync.
      </p>
    </main>
  );
}
