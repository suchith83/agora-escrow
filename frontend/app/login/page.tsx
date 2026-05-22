"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card max-w-md mx-auto space-y-2 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-mute">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
        <p className="text-xs text-mute pt-2">Didn’t arrive? Check spam, then try again.</p>
      </div>
    );
  }

  return (
    <div className="card max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sign in to Agora</h1>
        <p className="text-sm text-mute mt-1">
          One-tap magic link. No passwords.
        </p>
      </div>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <div className="text-sm text-red-700">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !email}>
          {busy ? "Sending…" : "Send magic link"}
        </button>
      </form>
    </div>
  );
}
