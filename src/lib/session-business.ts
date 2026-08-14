import { cookies } from "next/headers";
import { BusinessType, parseBusinessType } from "@/lib/business-type";
import { requireCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export async function getBusinessType(): Promise<BusinessType> {
  try {
    const { company } = await requireCompany();
    if (company?.businessType) {
      return parseBusinessType(company.businessType);
    }
  } catch {
    // Fall through for unauthenticated edge cases
  }

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const metaType = data.user?.user_metadata?.business_type;
    if (metaType) return parseBusinessType(metaType);
  }

  const cookieStore = await cookies();
  const cookieType = cookieStore.get("cbm_business_type")?.value;
  if (cookieType) return parseBusinessType(cookieType);
  return "BOTH";
}

export async function setBusinessTypeCookie(type: BusinessType) {
  const cookieStore = await cookies();
  cookieStore.set("cbm_business_type", type, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
