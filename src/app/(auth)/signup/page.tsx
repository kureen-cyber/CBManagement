"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { isSupabaseConfigured } from "@/lib/constants";
import { Panel } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (!configured) {
        setError("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable signup.");
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signUp({ email, password });
      if (signError) {
        setError(signError.message);
        return;
      }
      setMessage("Check your email to confirm, or sign in if confirmations are disabled.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="auth-card">
      <div className="brand-mark" style={{ fontSize: "1.8rem" }}>
        Create account
      </div>
      <p className="muted" style={{ marginTop: "0.4rem" }}>
        Powered by Supabase Auth.
      </p>

      <form onSubmit={onSubmit} className="stack" style={{ marginTop: "1.25rem" }}>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!configured}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={!configured}
          />
        </label>
        {error ? <div className="badge badge-danger">{error}</div> : null}
        {message ? <div className="badge badge-ok">{message}</div> : null}
        <button className="btn btn-primary" type="submit" disabled={loading || !configured}>
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--sea)", fontWeight: 700 }}>
          Sign in
        </Link>
        {" · "}
        <Link href="/demo" style={{ color: "var(--accent)", fontWeight: 700 }}>
          Try Demo
        </Link>
      </p>
    </Panel>
  );
}
