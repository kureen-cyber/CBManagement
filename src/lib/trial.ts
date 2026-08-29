import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export const TRIAL_DAYS = 30;

export type TrialFields = {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialWelcomeAcknowledgedAt: Date | null;
};

export function trialEndsAtFrom(start: Date): Date {
  return addDays(start, TRIAL_DAYS);
}

export function isTrialExpired(company: TrialFields): boolean {
  if (!company.trialStartedAt || !company.trialEndsAt) return false;
  return company.trialEndsAt.getTime() < Date.now();
}

export function hasAppAccess(company: TrialFields): boolean {
  if (!company.trialStartedAt) return true;
  return !isTrialExpired(company);
}

export function shouldShowTrialWelcome(company: TrialFields): boolean {
  return !!company.trialStartedAt && !company.trialWelcomeAcknowledgedAt;
}

export function trialDaysRemaining(company: TrialFields): number | null {
  if (!company.trialEndsAt) return null;
  const ms = company.trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Legacy accounts: start the 30-day trial on first signed-in app visit. */
export async function ensureTrialForCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.trialStartedAt) return company;

  const now = new Date();
  return prisma.company.update({
    where: { id: companyId },
    data: {
      trialStartedAt: now,
      trialEndsAt: trialEndsAtFrom(now),
    },
  });
}

export function trialBlockedPathAllowed(pathname: string): boolean {
  return pathname === "/trial-expired" || pathname.startsWith("/settings");
}
