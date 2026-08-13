import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBusinessType } from "@/lib/business-type";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessName = String(body.businessName || "My Business").trim() || "My Business";
  const businessType = parseBusinessType(body.businessType);

  const existing = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    await prisma.company.update({
      where: { id: existing.id },
      data: { name: businessName, businessType },
    });
  } else {
    await prisma.company.create({
      data: { name: businessName, businessType, currency: "TTD", vatRate: 0.125 },
    });
  }

  const res = NextResponse.json({ ok: true, businessType });
  res.cookies.set("cbm_business_type", businessType, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
