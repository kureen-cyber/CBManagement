import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { BusinessType, parseBusinessType } from "@/lib/business-type";

export async function getBusinessType(): Promise<BusinessType> {
  const cookieStore = await cookies();
  const cookieType = cookieStore.get("cbm_business_type")?.value;

  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (company?.businessType) {
    return parseBusinessType(company.businessType);
  }

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const metaType = data.user?.user_metadata?.business_type;
    if (metaType) return parseBusinessType(metaType);
  }

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
