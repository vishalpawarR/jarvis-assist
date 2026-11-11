import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function getTrackedSites(supabase: SupabaseClient<Database>) {
  return supabase.from("tracked_sites").select("*").is("deleted_at", null).order("label");
}
