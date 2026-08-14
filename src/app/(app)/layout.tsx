import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";
import { syncCompanyFromUser } from "@/lib/company";
import { parseTheme } from "@/lib/settings";
import { isLocalhostDemoHost, parsePlanTier } from "@/lib/tier";

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
  const showDemoNav = isLocalhostDemoHost(hdrs.get("host"));

  const businessName =
    String(user?.user_metadata?.business_name || user?.user_metadata?.full_name || "").trim() ||
    company.name;

  return (
    <div className="app-shell">
      <ThemeScript theme={theme} />
      <Sidebar
        email={user?.email}
        businessName={businessName}
        businessType={businessType}
        planTier={planTier}
        showDemoNav={showDemoNav}
      />
      <main className="main">{children}</main>
    </div>
  );
}
