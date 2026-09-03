import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { acceptAndConvertQuotation } from "@/app/actions";
import { AddEntityTab } from "@/components/AddEntityTab";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { QuotationForm } from "@/components/QuotationForm";
import { PeriodSelector } from "@/components/PeriodSelector";
import { formatAppDate } from "@/lib/timezone";
import { excludeSystemCustomers } from "@/lib/owner-drawings";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  await enforceTierPath("/quotations");
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);

  const [customers, quotations, supplyItems] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.quotation.findMany({
      where: { companyId, createdAt: { gte: range.start, lte: range.end } },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.supplierItem.findMany({
      where: { companyId },
      orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  const crmCustomers = excludeSystemCustomers(customers);

  return (
    <div className="stack">
      <PageHeader
        title="Quotations"
        description={`${range.label} · enter your costs, then set markup % at the end.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector
          basePath="/quotations"
          range={range}
          isFree={isFreeTier(planTier)}
        />
      </Panel>
      <AddEntityTab label="Add quotation" title="New quotation" wide>
        <QuotationForm
          customers={crmCustomers.map((c) => ({ id: c.id, name: c.name }))}
          supplyCatalog={supplyItems.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            unitCost: i.unitCost,
            supplyType: i.supplyType,
            supplierName: i.supplier.name,
          }))}
        />
      </AddEntityTab>
      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const cost =
                q.labourCost +
                q.materialsCost +
                q.equipmentCost +
                q.transportCost +
                q.otherCost;
              return (
                <tr key={q.id}>
                  <td>
                    <strong>{q.number}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {q.title}
                      {q.fixedPrice ? " · Fixed price" : ""}
                    </div>
                  </td>
                  <td>{formatAppDate(q.createdAt)}</td>
                  <td>{q.customer.name}</td>
                  <td className="money">{formatTTD(cost)}</td>
                  <td className="money">{formatTTD(q.total)}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: "0.4rem" }}>
                      <Link className="btn btn-secondary btn-sm" href={`/quotations/${q.id}`}>
                        View
                      </Link>
                      {q.status !== "CONVERTED" ? (
                        <Link className="btn btn-secondary btn-sm" href={`/quotations/${q.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                      {q.status !== "CONVERTED" ? (
                        <form
                          action={async () => {
                            "use server";
                            await acceptAndConvertQuotation(q.id);
                          }}
                        >
                          <button className="btn btn-accent btn-sm" type="submit">
                            Accept → Job + Invoice
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No quotations in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
