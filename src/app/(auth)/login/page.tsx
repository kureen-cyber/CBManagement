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
      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }

      const businessType = String(data.user?.user_metadata?.business_type || "BOTH").toUpperCase();
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.user?.user_metadata?.business_name || "My Business",
          businessType,
        }),
      });

      router.push(businessType === "RETAIL" && next === "/" ? "/pos" : next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function enterDemo(type: "RETAIL" | "SERVICE" | "BOTH") {
    setLoading(true);
    await fetch("/auth/demo", { method: "POST" });
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: "Island Works Ltd.",
        businessType: type,
      }),
    });
    router.push(type === "RETAIL" ? "/pos" : "/demo");
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

      <Link
        href="/signup"
        className="btn btn-primary"
        style={{ marginTop: "1rem", width: "100%", textAlign: "center" }}
      >
        Create account / Sign up
      </Link>

      {!configured ? (
        <div className="demo-banner" style={{ marginTop: "1rem" }}>
          Supabase keys are not set yet. You can still browse with Demo.
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
        <button className="btn btn-secondary" type="submit" disabled={loading || !configured}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="stack" style={{ marginTop: "1rem" }}>
        <div className="muted" style={{ fontSize: "0.82rem" }}>
          Try demo as:
        </div>
        <div className="row">
          <button
            className="btn btn-accent btn-sm"
            type="button"
            disabled={loading}
            onClick={() => enterDemo("RETAIL")}
          >
            Retail POS
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={loading}
            onClick={() => enterDemo("SERVICE")}
          >
            Service
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={loading}
            onClick={() => enterDemo("BOTH")}
          >
            Both
          </button>
        </div>
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
