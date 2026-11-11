"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthState = { error?: string; notice?: string };

const credentialsSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(10, "Password must be at least 10 characters.").max(128),
});

function getCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signIn(_state: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Add your Supabase URL and publishable key to web/.env.local first." };
  }
  const credentials = getCredentials(formData);
  if (!credentials.success)
    return { error: credentials.error.issues[0]?.message ?? "Check your details." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error) return { error: "Sign-in failed. Check your email and password, then try again." };
  redirect("/dashboard");
}

export async function signUp(_state: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Add your Supabase URL and publishable key to web/.env.local first." };
  }
  const credentials = getCredentials(formData);
  if (!credentials.success)
    return { error: credentials.error.issues[0]?.message ?? "Check your details." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: "Could not create your account. Check your details and try again." };
  if (data.session) redirect("/dashboard");
  return { notice: "Account created. Check your email to confirm your address, then sign in." };
}

export async function signOut() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Jarvis could not sign out.", error);
    redirect("/dashboard?error=signout");
  }
  redirect("/login");
}
