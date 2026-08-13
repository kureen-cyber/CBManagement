import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";
import { syncCompanyFromUser } from "@/lib/company";
import { parseTheme } from "@/lib/settings";

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
      />
      <main className="main">{children}</main>
    </div>
  );
}
