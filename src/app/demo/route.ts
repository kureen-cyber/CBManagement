import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDemoCompany } from "@/lib/seed-demo-company";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE,
  demoSessionCookieOptions,
} from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/server";

/**
 * Start an interactive demo session against the seeded demo company.
 * Sets a short-lived cookie and sends the visitor into the app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Real signed-in users keep their own company — send them into the app.
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user) {
    const businessType = String(user.user_metadata?.business_type || "").toUpperCase();
    return NextResponse.redirect(
      new URL(businessType === "RETAIL" ? "/pos" : "/home", url.origin),
    );
  }

  const reset = url.searchParams.get("reset") === "1";
  if (reset) {
    const existing = await prisma.company.findFirst({ where: { isDemo: true } });
    if (existing) {
      // Force re-seed by clearing products so ensureDemoCompany rebuilds sample data.
      await prisma.saleLine.deleteMany({ where: { sale: { companyId: existing.id } } });
      await prisma.sale.deleteMany({ where: { companyId: existing.id } });
      await prisma.product.deleteMany({ where: { companyId: existing.id } });
    }
  }

  const company = await ensureDemoCompany(prisma);

  const destination = new URL("/home", url.origin);
  const response = NextResponse.redirect(destination);
  response.cookies.set(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE, demoSessionCookieOptions());
  response.cookies.set("cbm_business_type", company.businessType || "BOTH", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set("cbm_theme", company.theme || "red-white-black", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
