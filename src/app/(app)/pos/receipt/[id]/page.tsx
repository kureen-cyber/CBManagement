import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import {
  receiptFooterText,
  receiptHeaderText,
  receiptLabels,
} from "@/lib/settings";
import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  isFreeRetailTier,
  parsePlanTier,
  receiptVisibleSince,
} from "@/lib/tier";
import {
  readActiveRegisterIdFromCookies,
  resolveRegisterAccess,
} from "@/lib/register-access";
import { PageHeader, Panel } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { RefundButton } from "@/components/RefundButton";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const since = receiptVisibleSince(planTier);
  const labels = receiptLabels(company.receiptLanguage);
  const header = receiptHeaderText(company);
  const footer = receiptFooterText(company);
  const showCustomer = company.receiptShowCustomer !== false;
  const showComments = company.receiptShowComments === true;
  const showHoneyPersons = company.receiptHoneyPersons === true;
  const showApiary = company.receiptShowApiaryNumber === true;
  const showOpr = company.receiptShowOprNumber === true;

  const sale = await prisma.sale.findFirst({
    where: { id, companyId },
    include: { customer: true, lines: true, posRegister: true, refunds: true },
  });
  if (!sale) notFound();

  const registers = await prisma.posRegister.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(registers, activeRegisterId);

  if (since && sale.soldAt < since) {
    return (
      <div className="stack">
        <PageHeader title="Receipt expired" description={sale.number} />
        <Panel style={{ padding: "1.25rem" }}>
          <p>
            Free Retail keeps sales receipts visible for{" "}
            {FREE_TIER_MAX_TRANSACTION_DAYS} days. This receipt is older and is no longer
            available to view or print.
          </p>
          <Link className="btn btn-secondary" href="/pos">
            Back to POS
          </Link>
        </Panel>
      </div>
    );
  }

  const canPrint = company.receiptPrinting !== false;
  const alreadyRefunded = sale.refunds.length > 0 || sale.isRefund;
  const canRefund =
    access.canRefund &&
    sale.status === "COMPLETED" &&
    !sale.isRefund &&
    !alreadyRefunded;
  const locale =
    company.receiptLanguage === "es"
      ? "es-ES"
      : company.receiptLanguage === "fr"
        ? "fr-FR"
        : "en-TT";

  return (
    <div className="stack">
      <PageHeader
        title={sale.isRefund ? "Refund receipt" : "Receipt"}
        description={sale.number}
        actions={
          <>
            <PrintButton enabled={canPrint} />
            <RefundButton
              saleId={sale.id}
              posRegisterId={access.registerId}
              disabled={!canRefund}
            />
            <Link className="btn btn-secondary" href="/pos">
              Back to POS
            </Link>
          </>
        }
      />

      <Panel className="receipt-sheet" style={{ padding: "1.5rem", maxWidth: 420 }}>
        <div style={{ textAlign: "center" }}>
          {company.receiptLogoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.receiptLogoData}
              alt=""
              className="receipt-logo"
            />
          ) : null}
          <div className="brand-mark" style={{ fontSize: "1.35rem" }}>
            {header}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {sale.isRefund ? "Refund" : labels.salesReceipt}
            {isFreeRetailTier(planTier) ? ` · ${FREE_TIER_MAX_TRANSACTION_DAYS}-day visibility` : ""}
          </div>
        </div>

        <div className="stack" style={{ marginTop: "1rem", fontSize: "0.92rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>{labels.receiptNo}</span>
            <strong>{sale.number}</strong>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>{labels.date}</span>
            <span>{sale.soldAt.toLocaleString(locale)}</span>
          </div>
          {sale.posRegister ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>{labels.register}</span>
              <span>{sale.posRegister.name}</span>
            </div>
          ) : null}
          {showCustomer ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>{labels.customer}</span>
              <span>{sale.customer?.name ?? labels.walkIn}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>{labels.payment}</span>
            <span>{sale.method}</span>
          </div>
          {showHoneyPersons && sale.honeyPersons?.trim() ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Persons involved</span>
              <span>{sale.honeyPersons.trim()}</span>
            </div>
          ) : null}
          {showApiary && company.receiptApiaryNumber?.trim() ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Apiary Number</span>
              <span>{company.receiptApiaryNumber.trim()}</span>
            </div>
          ) : null}
          {showOpr && company.receiptOprNumber?.trim() ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>OPR #</span>
              <span>{company.receiptOprNumber.trim()}</span>
            </div>
          ) : null}
        </div>

        <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "1rem 0" }} />

        <table className="data" style={{ fontSize: "0.88rem" }}>
          <thead>
            <tr>
              <th>{labels.item}</th>
              <th>{labels.qty}</th>
              <th>{labels.total}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.description}
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatTTD(l.unitPrice)} {labels.each}
                  </div>
                </td>
                <td>{l.quantity}</td>
                <td className="money">{formatTTD(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
          <span>{labels.subtotal}</span>
          <span className="money">{formatTTD(sale.subtotal)}</span>
        </div>
        {sale.discountAmount ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              Discount
              {sale.discountPercent ? ` (${sale.discountPercent}%)` : ""}
            </span>
            <span className="money">−{formatTTD(Math.abs(sale.discountAmount))}</span>
          </div>
        ) : null}
        {sale.taxAmount !== 0 && company.taxEnabled !== false ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              {labels.vat} ({((company.vatRate ?? 0.125) * 100).toFixed(1)}%)
            </span>
            <span className="money">{formatTTD(sale.taxAmount)}</span>
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: "space-between", marginTop: "0.35rem" }}>
          <strong>{labels.totalPaid}</strong>
          <strong className="money" style={{ fontSize: "1.25rem" }}>
            {formatTTD(sale.total)}
          </strong>
        </div>

        {alreadyRefunded && !sale.isRefund ? (
          <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
            This sale has been refunded.
          </p>
        ) : null}

        {showComments && sale.notes?.trim() ? (
          <div style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
            <strong>{labels.comments}</strong>
            <p className="muted" style={{ margin: "0.35rem 0 0", whiteSpace: "pre-wrap" }}>
              {sale.notes.trim()}
            </p>
          </div>
        ) : null}

        <p className="muted" style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem" }}>
          {footer}
        </p>
      </Panel>
    </div>
  );
}
