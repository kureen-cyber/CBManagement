import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getBusinessType } from "@/lib/session-business";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const cookieStore = await cookies();
  const demo = cookieStore.get("cbm_demo")?.value === "1";
  const businessType = await getBusinessType();

  return (
    <div className="app-shell">
      <Sidebar
        email={user?.email}
        demo={demo || (!user && true)}
        businessType={businessType}
      />
      <main className="main">{children}</main>
    </div>
  );
}
