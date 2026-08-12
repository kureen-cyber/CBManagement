"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS, isSupabaseConfigured } from "@/lib/constants";

export function Sidebar({
  email,
  demo,
}: {
  email?: string | null;
  demo?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const configured = isSupabaseConfigured();

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
        <div className="brand-sub">Run your entire business from one place</div>
      </div>
      <nav className="nav">
        {NAV_ITEMS.map((item) => {
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
