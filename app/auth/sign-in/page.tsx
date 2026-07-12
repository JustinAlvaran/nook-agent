"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { safeAppPath } from "../../../lib/security/navigation";

export default function SignInPage() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(provider: "google" | "github") {
    if (busy) return;
    setBusy(true);
    setNotice(`Opening ${provider === "google" ? "Google" : "GitHub"} securely…`);
    try {
      const search = new URLSearchParams(window.location.search);
      const next = safeAppPath(search.get("next"));
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
    } catch (error) {
      setBusy(false);
      setNotice(error instanceof Error ? error.message : "Sign-in could not start.");
    }
  }

  return <main className="nook-auth-shell">
    <section className="nook-auth-card">
      <Link className="onboard-brand" href="/"><span>›_</span>nook</Link>
      <div className="nook-auth-orb">›_</div>
      <span className="trend-kicker">YOUR NOOK IS WAITING</span>
      <h1>Come back to your room.</h1>
      <p>Sign in to save outfits, task plans, approvals, and future desktop pairings.</p>
      <button className="provider-button google" disabled={busy} onClick={() => signIn("google")}><span>G</span>Continue with Google</button>
      <button className="provider-button github" disabled={busy} onClick={() => signIn("github")}><span>⌁</span>Continue with GitHub</button>
      {notice && <div className="auth-notice" role="status"><b>Account status</b><p>{notice}</p></div>}
      <small>Nook never sees your provider password. Your provider handles authentication directly.</small>
    </section>
    <aside className="nook-auth-room"><div className="room-grid"/><div className="nook-auth-face"><i>›</i><i>_</i></div><p>“I’ll keep your place exactly how you left it.”</p></aside>
  </main>;
}
