import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";
import { syncCompanyFromUser } from "@/lib/company";
import { parseTheme } from "@/lib/settings";
import { isLocalhostDemoHost, parsePlanTier } from "@/lib/tier";
import { isDemoModeEnabled } from "@/lib/constants";
import { hasDemoSession } from "@/lib/demo-session";
import { prisma } from "@/lib/prisma";
import { resolveRegisterAccess } from "@/lib/register-access";
import {
  readActiveRegisterIdFromCookies,
  readActiveStoreIdFromCookies,
} from "@/lib/register-access-server";
import { ensureStoresForCompany } from "@/lib/store";
import { RegisterAccessGate } from "@/components/RegisterAccessGate";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const interactiveDemo = !user && (await hasDemoSession());
  const company = await syncCompanyFromUser(user);
  const businessType = await getBusinessType();
  const theme = parseTheme(company.theme);
  const planTier = parsePlanTier(company.planTier);
  const hdrs = await headers();
  const showDemoNav =
    isDemoModeEnabled() || isLocalhostDemoHost(hdrs.get("host"));

  const stores = await ensureStoresForCompany(company.id);
  const cookieStoreId = await readActiveStoreIdFromCookies();
  const activeStore = stores.find((s) => s.id === cookieStoreId) || stores[0] || null;

  const registers = await prisma.posRegister.findMany({
    where: {
      companyId: company.id,
      ...(activeStore ? { storeId: activeStore.id } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(registers, activeRegisterId);
  const activeRegister = registers.find((r) => r.id === access.registerId) || null;

  const businessName =
    String(user?.user_metadata?.business_name || user?.user_metadata?.full_name || "").trim() ||
    company.name;
  const browsingWithoutLogin = Boolean(!user && (isDemoModeEnabled() || interactiveDemo));

  return (
    <div className="app-shell">
      <ThemeScript theme={theme} />
      <RegisterAccessGate limited={access.isLimitedCashier} />
      <Sidebar
        email={
          user?.email ??
          (interactiveDemo ? "demo@cbmanagement.app" : isDemoModeEnabled() ? "demo@localhost" : undefined)
        }
        businessName={browsingWithoutLogin ? `${businessName} (Demo)` : businessName}
        businessType={businessType}
        planTier={planTier}
        showDemoNav={showDemoNav && !access.isLimitedCashier}
        limitedCashier={access.isLimitedCashier}
        registerLabel={activeRegister?.name ?? null}
      />
      <main className="main">
        {interactiveDemo ? (
          <div className="info-banner demo-banner" style={{ marginBottom: "1rem" }}>
            Interactive demo — exploring <strong>{company.name}</strong> with sample data.{" "}
            <Link href="/demo/exit">Exit demo</Link>
            {" · "}
            <Link href="/signup">Start free trial</Link>
            {" · "}
            <Link href="/demo?reset=1">Reset sample data</Link>
          </div>
        ) : null}
        {isDemoModeEnabled() && !user && !interactiveDemo ? (
          <div className="info-banner" style={{ marginBottom: "1rem" }}>
            Local demo mode — browsing without sign-in. Set{" "}
            <code>NEXT_PUBLIC_DEMO_MODE=false</code> when finished.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
