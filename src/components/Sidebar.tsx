"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/constants";
import { BusinessType, BUSINESS_TYPE_LABELS, navForBusinessType } from "@/lib/business-type";
import { PLAN_TIER_LABELS, type PlanTier } from "@/lib/tier";
import { LIMITED_CASHIER_NAV } from "@/lib/register-access";

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
  const items = limitedCashier
    ? [...LIMITED_CASHIER_NAV]
    : [
        ...navForBusinessType(businessType),
        ...(showDemoNav ? [{ href: "/demo-tier", label: "Demo (local)" } as const] : []),
      ];

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
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">CBManagement</div>
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
        <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", opacity: 0.8 }}>
          {BUSINESS_TYPE_LABELS[businessType]} · {PLAN_TIER_LABELS[planTier]}
          {registerLabel ? ` · ${registerLabel}` : ""}
          {limitedCashier ? " · limited" : ""}
        </div>
      </div>
      <nav className="nav">
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
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", opacity: 0.85 }}>
        {email ? <div>{email}</div> : <div>Local session</div>}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: "0.6rem", width: "100%" }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
