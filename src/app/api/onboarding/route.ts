import { NextResponse } from "next/server";
import { parseBusinessType } from "@/lib/business-type";
import { createClient } from "@/lib/supabase/server";
import { ensureCompanyForUser, updateOwnCompany } from "@/lib/company";
import { tierFromBusinessType } from "@/lib/tier";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = user.user_metadata ?? {};
  const businessName =
    String(body.businessName || meta.business_name || meta.full_name || "My Business").trim() ||
    "My Business";
  const businessType = parseBusinessType(body.businessType || meta.business_type);
  const planTier = tierFromBusinessType(businessType);

  const company = await ensureCompanyForUser({
    id: user.id,
    user_metadata: {
      ...meta,
      business_name: businessName,
      business_type: businessType,
    },
  });

  await updateOwnCompany(company.id, {
    name: businessName,
    businessType,
    planTier,
    homeLayout: businessType === "RETAIL" ? "RETAIL" : company.homeLayout,
  });

  const res = NextResponse.json({
    ok: true,
    businessType,
    businessName,
    companyId: company.id,
    planTier,
  });
  res.cookies.set("cbm_business_type", businessType, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
