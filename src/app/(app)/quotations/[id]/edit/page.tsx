import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { PageHeader, Panel } from "@/components/ui";
import { QuotationForm } from "@/components/QuotationForm";

export const dynamic = "force-dynamic";

export default async function QuotationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforceTierPath("/quotations");
  const { id } = await params;
  const { companyId } = await requireCompany();
  const [customers, quote, supplyItems] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.quotation.findFirst({
      where: { id, companyId },
      include: { lines: true },
    }),
    prisma.supplierItem.findMany({
      where: { companyId },
      orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
      include: { supplier: { select: { name: true } } },
    }),
  ]);
  if (!quote) notFound();
  if (quote.status === "CONVERTED") notFound();

  const customLines = quote.lines.filter((l) => l.category === "CUSTOM" || l.category === "OTHER");
  const extras =
    customLines.length > 0
      ? customLines.map((l) => ({
          name: l.description,
          amount: l.unitCost > 0 ? l.unitCost : l.lineTotal,
        }))
      : quote.otherCost > 0
        ? [{ name: "Other", amount: quote.otherCost }]
        : [];

  return (
    <div className="stack">
      <PageHeader
        title="Edit quotation"
        description={quote.number}
        actions={
          <Link className="btn btn-secondary" href={`/quotations/${quote.id}`}>
            Back
          </Link>
        }
      />
      <Panel style={{ padding: "1.25rem" }}>
        <QuotationForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          supplyCatalog={supplyItems.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            unitCost: i.unitCost,
            supplierName: i.supplier.name,
          }))}
          initial={{
            id: quote.id,
            customerId: quote.customerId,
            title: quote.title,
            labourCost: quote.labourCost,
            materialsCost: quote.materialsCost,
            equipmentCost: quote.equipmentCost,
            transportCost: quote.transportCost,
            markupPct: quote.markupPct,
            fixedPrice: quote.fixedPrice,
            total: quote.total,
            extras,
            notes: quote.notes,
          }}
        />
      </Panel>
    </div>
  );
}
