/** Job lifecycle statuses driven by engagement dates + invoice payments. */

export const JOB_STATUSES = [
  "PENDING",
  "ACTIVE",
  "AWAITING_FINAL_PAYMENT",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  AWAITING_FINAL_PAYMENT: "Awaiting final payment",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function needsEngagementPeriod(job: {
  startDate: Date | null;
  endDate: Date | null;
}): boolean {
  return !job.startDate || !job.endDate;
}

/**
 * Resolve job status from engagement window and payment completion.
 * - No dates → PENDING (prompt owner to set period of engagement)
 * - Before start → PENDING
 * - On/after start and before end → ACTIVE
 * - On/after end, unpaid → AWAITING_FINAL_PAYMENT
 * - On/after end, paid → COMPLETED
 */
export function resolveJobStatus(opts: {
  startDate: Date | null;
  endDate: Date | null;
  paymentsComplete: boolean;
  now?: Date;
}): JobStatus {
  const { startDate, endDate, paymentsComplete } = opts;
  if (!startDate || !endDate) return "PENDING";

  const now = startOfDay(opts.now ?? new Date());
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (now < start) return "PENDING";
  if (now < end) return "ACTIVE";
  // End date has been reached
  return paymentsComplete ? "COMPLETED" : "AWAITING_FINAL_PAYMENT";
}

export function jobPaymentsComplete(
  invoices: { total: number; amountPaid: number; status: string }[],
): boolean {
  const open = invoices.filter((inv) => inv.status !== "VOID" && inv.status !== "CANCELLED");
  if (open.length === 0) return false;
  return open.every((inv) => inv.amountPaid >= inv.total);
}
