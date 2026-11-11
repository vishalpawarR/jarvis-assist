import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) return children;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) console.error("Jarvis could not verify the dashboard session.", error);
  if (!user) redirect("/login");
  return children;
}
