"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/company";

export async function acknowledgeTrialWelcome() {
  const { companyId } = await requireCompany();
  const { prisma } = await import("@/lib/prisma");

  await prisma.company.update({
    where: { id: companyId },
    data: { trialWelcomeAcknowledgedAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
