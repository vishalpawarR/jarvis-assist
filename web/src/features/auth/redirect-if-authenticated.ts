import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function redirectIfAuthenticated() {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) console.error("Jarvis could not verify the current user.", error);
  if (user) redirect("/dashboard");
}
