import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { receiptFooterText, receiptHeaderText } from "@/lib/settings";
import { quotationClientLines } from "@/lib/quotation-pricing";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { EmailDocumentButton } from "@/components/EmailDocumentButton";

export const dynamic = "force-dynamic";

export default async function QuotationViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforceTierPath("/quotations");
  const { id } = await params;
  const { companyId, company } = await requireCompany();
  const quote = await prisma.quotation.findFirst({
    where: { id, companyId },
    include: { customer: true, lines: true },
  });
  if (!quote) notFound();

  const clientLines = quotationClientLines(quote);
  const header = receiptHeaderText(company);
  const footer = receiptFooterText(company);
  const canPrint = company.receiptPrinting !== false;

  return (
    <div className="stack">
      <PageHeader
        title="Quotation"
        description={quote.number}
        actions={
          <>
            {quote.status !== "CONVERTED" ? (
              <Link className="btn btn-primary" href={`/quotations/${quote.id}/edit`}>
                Edit
              </Link>
            ) : null}
            <PrintButton enabled={canPrint} />
            <EmailDocumentButton
              kind="quotation"
              documentId={quote.id}
              defaultEmail={quote.customer.email}
            />
            <Link className="btn btn-secondary" href="/quotations">
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
            Quotation
          </div>
        </div>

        <div className="stack" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Quote #</span>
            <strong>{quote.number}</strong>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Date</span>
            <span>{quote.createdAt.toLocaleDateString("en-TT")}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Customer</span>
            <span>{quote.customer.name}</span>
          </div>
          {quote.title ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Title</span>
              <span>{quote.title}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Status</span>
            <StatusBadge status={quote.status} />
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "1rem 0" }} />

        <table className="data" style={{ fontSize: "0.88rem" }}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {clientLines.map((l) => (
              <tr key={l.label}>
                <td>{l.label}</td>
                <td className="money">{formatTTD(l.amount)}</td>
              </tr>
            ))}
            {clientLines.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted">
                  No line items
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: "space-between", marginTop: "0.85rem" }}>
          <strong>Total</strong>
          <strong className="money" style={{ fontSize: "1.25rem" }}>
            {formatTTD(quote.total)}
          </strong>
        </div>

        {quote.notes?.trim() ? (
          <p className="muted" style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
            {quote.notes.trim()}
          </p>
        ) : null}

        <p className="muted" style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem" }}>
          {footer}
        </p>
      </Panel>
    </div>
  );
}
