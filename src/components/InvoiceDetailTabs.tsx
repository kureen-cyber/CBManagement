"use client";

import type { ReactNode } from "react";

/**
 * Invoice detail shell. Employee assignment was removed so the Employees
 * registry stays standalone; dashboard still shows an employee headcount.
 */
export function InvoiceDetailTabs({
  invoiceView,
}: {
  invoiceView: ReactNode;
  invoiceId?: string;
  jobNumber?: string | null;
  employees?: unknown;
  assignments?: unknown;
}) {
  return <div className="stack">{invoiceView}</div>;
}
