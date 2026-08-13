"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { isSupabaseConfigured } from "@/lib/constants";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
  BusinessType,
} from "@/lib/business-type";
import { Panel } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("RETAIL");
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
      const { data, error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName.trim(),
            business_type: businessType,
            full_name: businessName.trim(),
          },
        },
      });
      if (signError) {
        setError(signError.message);
        return;
      }

      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType,
        }),
      });

      if (data.session) {
        router.push(businessType === "RETAIL" ? "/pos" : "/");
        router.refresh();
        return;
      }

      setMessage(
        "Account created. Check your email to confirm, then sign in. Your business type is saved.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="auth-card">
      <div className="brand-mark" style={{ fontSize: "1.8rem" }}>
        Create your account
      </div>
      <p className="muted" style={{ marginTop: "0.4rem" }}>
        Tell us what kind of business you run — we shape the app around it.
      </p>

      <form onSubmit={onSubmit} className="stack" style={{ marginTop: "1.25rem" }}>
        <label className="field">
          Business name
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            disabled={!configured}
            placeholder="Island Retail Ltd."
          />
        </label>
        <label className="field">
          Business type
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as BusinessType)}
            required
            disabled={!configured}
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {businessType === "RETAIL" ? (
          <div className="demo-banner">
            Retail mode opens on a Loyverse-style POS: sell, register customers, manage stock, and print receipts.
          </div>
        ) : null}
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
            required
            minLength={6}
            disabled={!configured}
          />
        </label>
        {error ? <div className="badge badge-danger">{error}</div> : null}
        {message ? <div className="badge badge-ok">{message}</div> : null}
        <button className="btn btn-primary" type="submit" disabled={loading || !configured}>
          {loading ? "Creating account…" : "Sign up"}
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
