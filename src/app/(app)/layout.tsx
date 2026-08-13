import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";
import { getCompany } from "@/lib/company";
import { parseTheme } from "@/lib/settings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const businessType = await getBusinessType();
  const company = await getCompany();
  const theme = parseTheme(company.theme);

  return (
    <div className="app-shell">
      <ThemeScript theme={theme} />
      <Sidebar email={user?.email} businessType={businessType} />
      <main className="main">{children}</main>
    </div>
  );
}
