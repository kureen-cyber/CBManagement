import { isSalaryPayment } from "@/lib/owner-drawings";

export type PaymentDirection = "incoming" | "outgoing";
export type IncomingPaymentType = "POS" | "Invoice";
export type OutgoingPaymentType = "Salary" | "Operational";

type ClassifiablePayment = {
  kind?: string | null;
  notes?: string | null;
  reference?: string | null;
  employeeId?: string | null;
  supplierId?: string | null;
  customerId?: string | null;
  invoiceId?: string | null;
  saleId?: string | null;
  employee?: { systemRole?: string | null } | null;
  customer?: { name?: string | null } | null;
  sale?: { number?: string | null } | null;
  invoice?: { number?: string | null } | null;
};

function looksLikePos(payment: ClassifiablePayment): boolean {
  if (payment.saleId || payment.sale) return true;
  const ref = String(payment.reference || "").trim();
  if (/^POS/i.test(ref)) return true;
  const blob = `${ref} ${payment.notes || ""}`.toLowerCase();
  return blob.includes("pos");
}

/** Outgoing = salary/owner drawings or supplier / operational outflows. */
export function isOutgoingPayment(payment: ClassifiablePayment): boolean {
  if (isSalaryPayment(payment)) return true;
  if (payment.supplierId) return true;
  return false;
}

/** Incoming = POS till/receivable payments and invoice (job/service) receipts. */
export function isIncomingPayment(payment: ClassifiablePayment): boolean {
  if (isOutgoingPayment(payment)) return false;
  if (payment.invoiceId || payment.saleId) return true;
  if (looksLikePos(payment)) return true;
  // Customer receipts without supplier/salary still count as incoming (invoice/service).
  return Boolean(payment.customerId);
}

export function paymentDirection(payment: ClassifiablePayment): PaymentDirection {
  return isOutgoingPayment(payment) ? "outgoing" : "incoming";
}

export function incomingPaymentType(payment: ClassifiablePayment): IncomingPaymentType {
  if (looksLikePos(payment)) return "POS";
  return "Invoice";
}

export function outgoingPaymentType(payment: ClassifiablePayment): OutgoingPaymentType {
  return isSalaryPayment(payment) ? "Salary" : "Operational";
}
