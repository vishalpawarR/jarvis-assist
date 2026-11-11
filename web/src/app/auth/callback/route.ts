import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Jarvis could not complete email confirmation.", error);
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
