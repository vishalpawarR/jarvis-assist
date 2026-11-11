import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function getSavedPages(supabase: SupabaseClient<Database>) {
  return supabase
    .from("saved_pages")
    .select("*")
    .is("deleted_at", null)
    .order("saved_at", { ascending: false });
}
