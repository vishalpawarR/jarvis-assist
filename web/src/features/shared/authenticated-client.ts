import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Jarvis could not verify the current user.", error);
    redirect("/login?error=session");
  }
  if (!user) redirect("/login");
  return { supabase, user };
}
