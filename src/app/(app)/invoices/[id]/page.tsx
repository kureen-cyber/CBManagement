import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { receiptFooterText, receiptHeaderText } from "@/lib/settings";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforceTierPath("/invoices");
  const { id } = await params;
  const { companyId, company } = await requireCompany();
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: { customer: true, job: true, lines: true, payments: true },
  });
  if (!invoice) notFound();

  const header = receiptHeaderText(company);
  const footer = receiptFooterText(company);
  const canPrint = company.receiptPrinting !== false;
  const balance = invoice.total - invoice.amountPaid;

  return (
    <div className="stack">
      <PageHeader
        title="Invoice"
        description={invoice.number}
        actions={
          <>
            <PrintButton enabled={canPrint} />
            <Link className="btn btn-secondary" href="/invoices">
              Back
            </Link>
          </>
        }
      />

      <Panel className="receipt-sheet" style={{ padding: "1.5rem", maxWidth: 480 }}>
        <div style={{ textAlign: "center" }}>
          {company.receiptLogoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.receiptLogoData} alt="" className="receipt-logo" />
          ) : null}
          <div className="brand-mark" style={{ fontSize: "1.35rem" }}>
            {header}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Invoice
          </div>
        </div>

        <div className="stack" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Invoice #</span>
            <strong>{invoice.number}</strong>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Issue date</span>
            <span>{invoice.issueDate.toLocaleDateString("en-TT")}</span>
          </div>
          {invoice.dueDate ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Due date</span>
              <span>{invoice.dueDate.toLocaleDateString("en-TT")}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Customer</span>
            <span>{invoice.customer.name}</span>
          </div>
          {invoice.job ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Job</span>
              <span>{invoice.job.number}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Status</span>
            <StatusBadge status={invoice.status} />
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
            {invoice.lines.length ? (
              invoice.lines.map((l) => (
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
              ))
            ) : (
              <tr>
                <td colSpan={3} className="muted">
                  Services / billed amount
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
          <span>Subtotal</span>
          <span className="money">{formatTTD(invoice.subtotal || invoice.total)}</span>
        </div>
        {invoice.taxAmount ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Tax</span>
            <span className="money">{formatTTD(invoice.taxAmount)}</span>
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: "space-between", marginTop: "0.35rem" }}>
          <strong>Total</strong>
          <strong className="money" style={{ fontSize: "1.25rem" }}>
            {formatTTD(invoice.total)}
          </strong>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>Paid</span>
          <span className="money">{formatTTD(invoice.amountPaid)}</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Balance</strong>
          <strong className="money">{formatTTD(balance)}</strong>
        </div>

        {invoice.notes?.trim() ? (
          <p className="muted" style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
            {invoice.notes.trim()}
          </p>
        ) : null}

        <p className="muted" style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem" }}>
          {footer}
        </p>
      </Panel>
    </div>
  );
}
