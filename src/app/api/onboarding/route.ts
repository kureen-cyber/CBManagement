import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBusinessType } from "@/lib/business-type";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const meta = user?.user_metadata ?? {};

  const businessName =
    String(body.businessName || meta.business_name || meta.full_name || "My Business").trim() ||
    "My Business";
  const businessType = parseBusinessType(body.businessType || meta.business_type);

  const existing = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    await prisma.company.update({
      where: { id: existing.id },
      data: {
        name: businessName,
        businessType,
        homeLayout: businessType === "RETAIL" ? "RETAIL" : existing.homeLayout,
      },
    });
  } else {
    await prisma.company.create({
      data: {
        name: businessName,
        businessType,
        currency: "TTD",
        vatRate: 0.125,
        homeLayout: businessType === "RETAIL" ? "RETAIL" : "RETAIL_SERVICE",
        receiptPrinting: true,
      },
    });
  }

  const res = NextResponse.json({ ok: true, businessType, businessName });
  res.cookies.set("cbm_business_type", businessType, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
