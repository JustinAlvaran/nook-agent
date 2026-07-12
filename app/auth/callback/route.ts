import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { safeAppPath } from "../../../lib/security/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAppPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = supabase
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("Supabase is not configured.") };
    if (!error) return NextResponse.redirect(new URL(next, url.origin), 303);
  }

  return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", url.origin), 303);
}
