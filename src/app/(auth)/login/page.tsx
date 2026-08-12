"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { isSupabaseConfigured } from "@/lib/constants";
import { Panel } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!configured) {
        setError("Supabase is not configured. Use Enter Demo instead, or add env vars.");
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function enterDemo() {
    setLoading(true);
    await fetch("/auth/demo", { method: "POST" });
    router.push("/demo");
    router.refresh();
  }

  return (
    <Panel className="auth-card">
      <div className="brand-mark" style={{ fontSize: "1.8rem" }}>
        CBManagement
      </div>
      <p className="muted" style={{ marginTop: "0.4rem" }}>
        Sign in to run your business from one place.
      </p>

      {!configured ? (
        <div className="demo-banner" style={{ marginTop: "1rem" }}>
          Supabase keys are not set yet. You can still browse with the Demo tab.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="stack" style={{ marginTop: "1.25rem" }}>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={configured}
            disabled={!configured}
            placeholder="you@business.tt"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={configured}
            disabled={!configured}
            minLength={6}
          />
        </label>
        {error ? <div className="badge badge-danger">{error}</div> : null}
        <button className="btn btn-primary" type="submit" disabled={loading || !configured}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="stack" style={{ marginTop: "1rem" }}>
        <button className="btn btn-accent" type="button" onClick={enterDemo} disabled={loading}>
          Enter Demo
        </button>
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          No account?{" "}
          <Link href="/signup" style={{ color: "var(--sea)", fontWeight: 700 }}>
            Sign up
          </Link>
          {" · "}
          <Link href="/demo" style={{ color: "var(--sea)", fontWeight: 700 }}>
            Open Demo tab
          </Link>
        </p>
      </div>
    </Panel>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
