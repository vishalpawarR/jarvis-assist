import Link from "next/link";
import { AuthForm } from "@/features/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SignupPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="auth-page">
      <Link className="brand-link" href="/">
        <span className="brand-icon">J</span> Jarvis
      </Link>
      <section className="auth-card">
        <p className="eyebrow">Create your account</p>
        <h1>Start with Jarvis</h1>
        <p className="auth-description">Sign up to prepare a private, sync-ready workspace.</p>
        {!configured && (
          <div className="setup-notice" role="status">
            Supabase must be configured before accounts can be created. See the{" "}
            <Link href="/#setup">setup instructions</Link>.
          </div>
        )}
        <AuthForm mode="signup" />
      </section>
      <p className="auth-footnote">
        Your extension data is not uploaded when you create an account.
      </p>
    </main>
  );
}
