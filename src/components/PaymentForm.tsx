"use client";

import { useMemo, useState } from "react";
import { recordPayment } from "@/app/actions";
import { formatTTD, fromCents } from "@/lib/money";

type InvoiceOption = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  amountDue: number;
};

export function PaymentForm({
  customers,
  invoices,
}: {
  customers: { id: string; name: string }[];
  invoices: InvoiceOption[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId) || null,
    [invoices, invoiceId],
  );

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setCustomerId(inv.customerId);
  }

  return (
    <form action={recordPayment} className="form-grid">
      <label className="field">
        Invoice
        <select name="invoiceId" value={invoiceId} onChange={(e) => onInvoiceChange(e.target.value)}>
          <option value="">Unallocated</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number} — {inv.customerName} — {formatTTD(inv.amountDue)} due
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Customer
        <select
          name="customerId"
          required
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            if (selectedInvoice && selectedInvoice.customerId !== e.target.value) {
              setInvoiceId("");
            }
          }}
        >
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
        Amount (TT$)
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          key={selectedInvoice?.id ?? "unallocated"}
          defaultValue={selectedInvoice ? fromCents(selectedInvoice.amountDue) : ""}
        />
      </label>
      <label className="field">
        Method
        <select name="method" defaultValue="BANK">
          <option value="BANK">Bank</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
        </select>
      </label>
      <label className="field">
        Date
        <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </label>
      <div className="full">
        <button className="btn btn-primary" type="submit">
          Save payment
        </button>
      </div>
    </form>
  );
}
