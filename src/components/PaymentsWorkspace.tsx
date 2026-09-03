"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SalaryPaymentForm } from "@/components/SalaryPaymentForm";
import { PaymentForm } from "@/components/PaymentForm";
import { Panel } from "@/components/ui";
import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import {
  incomingPaymentType,
  isIncomingPayment,
  isOutgoingPayment,
  outgoingPaymentType,
} from "@/lib/payment-direction";

type InvoiceOption = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  amountDue: number;
};

type SaleOption = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  amountDue: number;
};

export type PaymentRow = {
  id: string;
  paidAt: string;
  amount: number;
  method: string;
  kind: string | null;
  notes: string | null;
  reference: string | null;
  employeeId: string | null;
  supplierId: string | null;
  customerId: string | null;
  invoiceId: string | null;
  saleId: string | null;
  payee: string;
  employeeSystemRole: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  saleNumber: string | null;
};

type Direction = "incoming" | "outgoing";
type AddModal = "incoming" | "salary" | "operational" | null;

export function PaymentsWorkspace({
  employees,
  customers,
  suppliers,
  invoices,
  sales,
  payments,
}: {
  employees: { id: string; name: string; systemRole?: string | null }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  invoices: InvoiceOption[];
  sales: SaleOption[];
  payments: PaymentRow[];
}) {
  const [direction, setDirection] = useState<Direction>("incoming");
  const [addModal, setAddModal] = useState<AddModal>(null);

  const classified = useMemo(() => {
    return payments.map((p) => {
      const shape = {
        kind: p.kind,
        notes: p.notes,
        reference: p.reference,
        employeeId: p.employeeId,
        supplierId: p.supplierId,
        customerId: p.customerId,
        invoiceId: p.invoiceId,
        saleId: p.saleId,
        employee: p.employeeSystemRole ? { systemRole: p.employeeSystemRole } : null,
        customer: p.customerName ? { name: p.customerName } : null,
        sale: p.saleNumber ? { number: p.saleNumber } : null,
        invoice: p.invoiceNumber ? { number: p.invoiceNumber } : null,
      };
      const incoming = isIncomingPayment(shape);
      return {
        ...p,
        incoming,
        outgoing: isOutgoingPayment(shape),
        typeLabel: incoming ? incomingPaymentType(shape) : outgoingPaymentType(shape),
        refLabel: p.invoiceNumber ?? p.saleNumber ?? p.reference ?? p.notes ?? "—",
      };
    });
  }, [payments]);

  const incomingRows = classified.filter((p) => p.incoming);
  const outgoingRows = classified.filter((p) => p.outgoing || (!p.incoming && !p.outgoing));
  const rows = direction === "incoming" ? incomingRows : outgoingRows;

  return (
    <div className="stack">
      <div className="inventory-top-tabs" role="tablist" aria-label="Payment direction">
        <button
          type="button"
          role="tab"
          aria-selected={direction === "incoming"}
          className={direction === "incoming" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setDirection("incoming")}
        >
          Incoming Payments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === "outgoing"}
          className={direction === "outgoing" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setDirection("outgoing")}
        >
          Outgoing Payments
        </button>
      </div>

      {direction === "incoming" ? (
        <div className="inventory-top-tabs" role="toolbar" aria-label="Add incoming payment">
          <button
            type="button"
            className="settings-subtab"
            onClick={() => setAddModal("incoming")}
          >
            Add Incoming Payment
          </button>
        </div>
      ) : (
        <div className="inventory-top-tabs" role="toolbar" aria-label="Add outgoing payment">
          <button type="button" className="settings-subtab" onClick={() => setAddModal("salary")}>
            Add Salary Payments
          </button>
          <button
            type="button"
            className="settings-subtab"
            onClick={() => setAddModal("operational")}
          >
            Add Operational Payments
          </button>
        </div>
      )}

      <Panel className="table-wrap list-dense">
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
          {direction === "incoming"
            ? "POS till and receivable payments, plus invoice receipts for jobs and services."
            : "Salary and owner drawings, plus supplier/stock and other operational outflows."}
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Payee</th>
              <th>Reference</th>
              <th>Method</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{formatAppDate(p.paidAt)}</td>
                <td>
                  <span className="badge">{p.typeLabel}</span>
                </td>
                <td>{p.payee}</td>
                <td className="muted">{p.refLabel}</td>
                <td>{p.method}</td>
                <td className="money">{formatTTD(p.amount)}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/payments/${p.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  {direction === "incoming"
                    ? "No incoming payments in this period."
                    : "No outgoing payments in this period."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      {addModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payments-add-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setAddModal(null)}
        >
          <div
            className="panel add-entity-modal"
            style={{
              padding: "1.25rem",
              width: "min(720px, 100%)",
              maxHeight: "min(90vh, 920px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3 id="payments-add-title" style={{ margin: 0 }}>
                {addModal === "incoming"
                  ? "Add incoming payment"
                  : addModal === "salary"
                    ? "Add salary payment"
                    : "Add operational payment"}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddModal(null)}
              >
                Close
              </button>
            </div>

            {addModal === "incoming" ? (
              <PaymentForm
                mode="incoming"
                customers={customers}
                invoices={invoices}
                sales={sales}
              />
            ) : null}
            {addModal === "salary" ? <SalaryPaymentForm employees={employees} /> : null}
            {addModal === "operational" ? (
              <PaymentForm mode="outgoing" suppliers={suppliers} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
