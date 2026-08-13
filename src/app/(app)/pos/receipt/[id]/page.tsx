import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { PageHeader, Panel } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { customer: true, lines: true },
  });
  if (!sale) notFound();

  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  const canPrint = company?.receiptPrinting !== false;

  return (
    <div className="stack">
      <PageHeader
        title="Receipt"
        description={sale.number}
        actions={
          <>
            <PrintButton enabled={canPrint} />
            <Link className="btn btn-secondary" href="/pos">
              Back to POS
            </Link>
          </>
        }
      />

      <Panel className="receipt-sheet" style={{ padding: "1.5rem", maxWidth: 420 }}>
        <div style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ fontSize: "1.35rem" }}>
            {company?.name || "CBManagement"}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Sales receipt
          </div>
        </div>

        <div className="stack" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Receipt #</span>
            <strong>{sale.number}</strong>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Date</span>
            <span>{sale.soldAt.toLocaleString("en-TT")}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Customer</span>
            <span>{sale.customer?.name ?? "Walk-in"}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Payment</span>
            <span>{sale.method}</span>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "1rem 0" }} />

        <table className="data" style={{ fontSize: "0.88rem" }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.description}
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatTTD(l.unitPrice)} each
                  </div>
                </td>
                <td>{l.quantity}</td>
                <td className="money">{formatTTD(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
          <span>Subtotal</span>
          <span className="money">{formatTTD(sale.subtotal)}</span>
        </div>
        {sale.taxAmount > 0 ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>VAT ({((company?.vatRate ?? 0.125) * 100).toFixed(1)}%)</span>
            <span className="money">{formatTTD(sale.taxAmount)}</span>
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: "space-between", marginTop: "0.35rem" }}>
          <strong>Total paid</strong>
          <strong className="money" style={{ fontSize: "1.25rem" }}>
            {formatTTD(sale.total)}
          </strong>
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem" }}>
          Thank you for your business
        </p>
      </Panel>
    </div>
  );
}
