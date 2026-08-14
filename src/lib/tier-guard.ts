import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/company";
import { isPathAllowedForTier, parsePlanTier } from "@/lib/tier";

/** Call at the top of pages that must respect plan-tier module locks. */
export async function enforceTierPath(pathname: string) {
  const { company } = await requireCompany();
  const tier = parsePlanTier(company.planTier);
  if (!isPathAllowedForTier(tier, pathname)) {
    redirect("/");
  }
  return { company, tier };
}
