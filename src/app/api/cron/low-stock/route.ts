import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklyLowStockDigest } from "@/lib/stock-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Weekly low-stock digest for companies with featureLowStockEmail enabled.
 * Secure with CRON_SECRET header: Authorization: Bearer <CRON_SECRET>
 * or ?secret=
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  if (secret && bearer !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
    where: { featureLowStockEmail: true },
    include: { members: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const canLookup =
    Boolean(supabaseUrl && serviceKey) && !String(serviceKey).includes("Unregistered");

  const admin =
    canLookup && supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  const results: { companyId: string; ok: boolean; count?: number; error?: string }[] = [];

  for (const company of companies) {
    const member = company.members[0];
    let email: string | null = null;

    if (admin && member?.userId) {
      try {
        const { data } = await admin.auth.admin.getUserById(member.userId);
        email = data.user?.email ?? null;
      } catch {
        email = null;
      }
    }

    // Fallback: env override for testing, or skip
    if (!email) {
      results.push({ companyId: company.id, ok: false, error: "No owner email" });
      continue;
    }

    const sent = await sendWeeklyLowStockDigest({
      companyId: company.id,
      companyName: company.name,
      toEmail: email,
    });
    results.push({
      companyId: company.id,
      ok: Boolean(sent.ok),
      count: "count" in sent ? sent.count : undefined,
      error: "error" in sent ? sent.error : undefined,
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
