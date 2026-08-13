"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/constants";
import { BusinessType, BUSINESS_TYPE_LABELS, navForBusinessType } from "@/lib/business-type";

export function Sidebar({
  email,
  demo,
  businessType = "BOTH",
}: {
  email?: string | null;
  demo?: boolean;
  businessType?: BusinessType;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const items = navForBusinessType(businessType);

  async function signOut() {
    if (configured) {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    await fetch("/auth/demo", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">CBManagement</div>
        <div className="brand-sub">
          {businessType === "RETAIL"
            ? "Retail POS · stock · receipts"
            : "Run your entire business from one place"}
        </div>
        <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", opacity: 0.8 }}>
          {BUSINESS_TYPE_LABELS[businessType]}
        </div>
      </div>
      <nav className="nav">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[active ? "active" : "", item.href === "/demo" ? "demo-link" : ""]
                .filter(Boolean)
                .join(" ") || undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", opacity: 0.85 }}>
        {demo ? (
          <div>Demo mode — sample data</div>
        ) : email ? (
          <div>{email}</div>
        ) : (
          <div>Local session</div>
        )}
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
