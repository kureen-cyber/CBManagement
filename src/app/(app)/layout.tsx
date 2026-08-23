import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";
import { syncCompanyFromUser } from "@/lib/company";
import { parseTheme } from "@/lib/settings";
import { isLocalhostDemoHost, parsePlanTier } from "@/lib/tier";
import { isDemoModeEnabled } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { resolveRegisterAccess } from "@/lib/register-access";
import { readActiveRegisterIdFromCookies } from "@/lib/register-access-server";
import { RegisterAccessGate } from "@/components/RegisterAccessGate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const company = await syncCompanyFromUser(user);
  const businessType = await getBusinessType();
  const theme = parseTheme(company.theme);
  const planTier = parsePlanTier(company.planTier);
  const hdrs = await headers();
  const showDemoNav =
    isDemoModeEnabled() || isLocalhostDemoHost(hdrs.get("host"));

  const registers = await prisma.posRegister.findMany({
    where: { companyId: company.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(registers, activeRegisterId);
  const activeRegister = registers.find((r) => r.id === access.registerId) || null;

  const businessName =
    String(user?.user_metadata?.business_name || user?.user_metadata?.full_name || "").trim() ||
    company.name;

  return (
    <div className="app-shell">
      <ThemeScript theme={theme} />
      <RegisterAccessGate limited={access.isLimitedCashier} />
      <Sidebar
        email={user?.email ?? (isDemoModeEnabled() ? "demo@localhost" : undefined)}
        businessName={isDemoModeEnabled() && !user ? `${businessName} (Demo)` : businessName}
        businessType={businessType}
        planTier={planTier}
        showDemoNav={showDemoNav && !access.isLimitedCashier}
        limitedCashier={access.isLimitedCashier}
        registerLabel={activeRegister?.name ?? null}
      />
      <main className="main">
        {isDemoModeEnabled() && !user ? (
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
