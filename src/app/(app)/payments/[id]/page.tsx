import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { receiptFooterText, receiptHeaderText } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { EmailDocumentButton } from "@/components/EmailDocumentButton";
import { formatAppDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId, company } = await requireCompany();
  const payment = await prisma.payment.findFirst({
    where: { id, companyId },
    include: { customer: true, invoice: true },
  });
  if (!payment) notFound();

  const header = receiptHeaderText(company);
  const footer = receiptFooterText(company);
  const canPrint = company.receiptPrinting !== false;

  return (
    <div className="stack">
      <PageHeader
        title="Payment receipt"
        description={payment.reference || payment.id.slice(0, 8)}
        actions={
          <>
            <PrintButton enabled={canPrint} />
            <EmailDocumentButton
              kind="payment"
              documentId={payment.id}
              defaultEmail={payment.customer.email}
            />
            <Link className="btn btn-secondary" href="/payments">
              Back
            </Link>
          </>
        }
      />

      <Panel className="receipt-sheet" style={{ padding: "1.5rem", maxWidth: 420 }}>
        <div style={{ textAlign: "center" }}>
          {company.receiptLogoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.receiptLogoData} alt="" className="receipt-logo" />
          ) : null}
          <div className="brand-mark" style={{ fontSize: "1.35rem" }}>
            {header}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Payment receipt
          </div>
        </div>

        <div className="stack" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Date</span>
            <span>{formatAppDateTime(payment.paidAt)}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Customer</span>
            <span>{payment.customer.name}</span>
          </div>
          {payment.invoice ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Invoice</span>
              <span>{payment.invoice.number}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Method</span>
            <span>{payment.method}</span>
          </div>
          {payment.reference ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Reference</span>
              <span>{payment.reference}</span>
            </div>
          ) : null}
        </div>

        <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "1rem 0" }} />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Amount received</strong>
          <strong className="money" style={{ fontSize: "1.25rem" }}>
            {formatTTD(payment.amount)}
          </strong>
        </div>

        {payment.notes?.trim() ? (
          <p className="muted" style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
            {payment.notes.trim()}
          </p>
        ) : null}

        <p className="muted" style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem" }}>
          {footer}
        </p>
      </Panel>
    </div>
  );
}
