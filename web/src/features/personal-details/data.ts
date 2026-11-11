import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function getPersonalDetails(supabase: SupabaseClient<Database>) {
  return supabase.from("personal_details").select("details").maybeSingle();
}
