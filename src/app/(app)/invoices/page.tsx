import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { createInvoice } from "@/app/actions";
import { AddEntityTab } from "@/components/AddEntityTab";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { PeriodSelector } from "@/components/PeriodSelector";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  await enforceTierPath("/invoices");
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);

  const [customers, jobs, invoices] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({
      where: { companyId, issueDate: { gte: range.start, lte: range.end } },
      orderBy: { issueDate: "desc" },
      include: {
        customer: true,
        job: {
          select: {
            id: true,
            number: true,
            quotation: { select: { id: true, number: true } },
          },
        },
        quotation: { select: { id: true, number: true } },
      },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Invoices"
        description={`${range.label} · bill customers and track what is still owed.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector basePath="/invoices" range={range} isFree={isFreeTier(planTier)} />
      </Panel>
      <AddEntityTab label="Add invoice" title="Create invoice">
        <form action={createInvoice} className="form-grid">
          <label className="field">
            Customer
            <select name="customerId" required defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Job
            <select name="jobId" defaultValue="">
              <option value="">None</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.number}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Description
            <input name="description" defaultValue="Services rendered" />
          </label>
          <label className="field">
            Amount (TT$)
            <input name="total" type="number" step="0.01" required />
          </label>
          <label className="field">
            Due date
            <input
              name="dueDate"
              type="date"
              defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}
            />
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              For job invoices, due date follows the job engagement end date when set.
            </span>
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit">
              Create invoice
            </button>
          </div>
        </form>
      </AddEntityTab>
      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Due</th>
              <th>Customer</th>
              <th>Quote number</th>
              <th>Job number</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const quote = inv.quotation ?? inv.job?.quotation ?? null;
              return (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.number}</strong>
                  </td>
                  <td>{formatAppDate(inv.issueDate)}</td>
                  <td>{formatAppDate(inv.dueDate)}</td>
                  <td>{inv.customer.name}</td>
                  <td>
                    {quote ? (
                      <div className="stack" style={{ gap: "0.25rem" }}>
                        <span>{quote.number}</span>
                        <Link
                          href={`/quotations/${quote.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ alignSelf: "flex-start" }}
                        >
                          View
                        </Link>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {inv.job ? (
                      <div className="stack" style={{ gap: "0.25rem" }}>
                        <span>{inv.job.number}</span>
                        <Link
                          href={`/jobs/${inv.job.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ alignSelf: "flex-start" }}
                        >
                          View
                        </Link>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="money">{formatTTD(inv.total)}</td>
                  <td className="money">{formatTTD(inv.amountPaid)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" href={`/invoices/${inv.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
                  No invoices in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
