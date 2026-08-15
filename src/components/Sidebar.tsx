"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/constants";
import { BusinessType, BUSINESS_TYPE_LABELS, navForBusinessType } from "@/lib/business-type";
import { PLAN_TIER_LABELS, type PlanTier } from "@/lib/tier";
import { LIMITED_CASHIER_NAV } from "@/lib/register-access";

const STORAGE_KEY = "cbm_nav_collapsed";

function shortLabel(label: string) {
  if (label === "POS") return "POS";
  if (label.startsWith("Items") || label === "Stock levels") return "Inv";
  const words = label.split(/\s+/);
  if (words.length === 1) return label.slice(0, 3);
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function Sidebar({
  email,
  businessName,
  businessType = "BOTH",
  planTier = "STANDARD",
  showDemoNav = false,
  limitedCashier = false,
  registerLabel = null,
}: {
  email?: string | null;
  businessName?: string | null;
  businessType?: BusinessType;
  planTier?: PlanTier;
  showDemoNav?: boolean;
  limitedCashier?: boolean;
  registerLabel?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const items = limitedCashier
    ? [...LIMITED_CASHIER_NAV]
    : [
        ...navForBusinessType(businessType),
        ...(showDemoNav ? [{ href: "/demo-tier", label: "Demo (local)" } as const] : []),
      ];

  // Compact rail only on desktop; phone/tablet drawer always shows full labels
  const compact = collapsed && !mobileOpen;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.navCollapsed = collapsed ? "1" : "0";
    document.documentElement.dataset.navOpen = mobileOpen ? "1" : "0";
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    if (configured) {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="nav-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="nav-icon-btn"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <span className="nav-burger" aria-hidden />
        </button>
        <div className="mobile-topbar-brand">
          <strong>CBManagement</strong>
          {businessName ? <span className="muted">{businessName}</span> : null}
        </div>
      </header>

      <div
        className={`nav-backdrop${mobileOpen ? " open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}${
          ready ? " ready" : ""
        }`}
      >
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">{compact ? "CB" : "CBManagement"}</div>
            {!compact ? (
              <>
                {businessName ? (
                  <div className="brand-business" title={businessName}>
                    {businessName}
                  </div>
                ) : null}
                <div className="brand-sub">
                  {businessType === "RETAIL"
                    ? "Retail POS · stock · receipts"
                    : "Run your entire business from one place"}
                </div>
                <div className="brand-meta">
                  {BUSINESS_TYPE_LABELS[businessType]} · {PLAN_TIER_LABELS[planTier]}
                  {registerLabel ? ` · ${registerLabel}` : ""}
                  {limitedCashier ? " · limited" : ""}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="nav-collapse-btn"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "»" : "«"}
          </button>
          <button
            type="button"
            className="nav-close-mobile"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="nav" aria-label="Main">
          {items.map((item) => {
            const active =
              item.href === "/home"
                ? pathname === "/home"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : undefined}
                title={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <span className="nav-abbr" aria-hidden>
                  {shortLabel(item.label)}
                </span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!compact ? (
            email ? (
              <div className="sidebar-email">{email}</div>
            ) : (
              <div className="sidebar-email">Local session</div>
            )
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm sidebar-signout"
            onClick={signOut}
            title="Sign out"
          >
            {compact ? "Out" : "Sign out"}
          </button>
        </div>
      </aside>
    </div>
  );
}
