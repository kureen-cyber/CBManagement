"use client";

import { useEffect, useMemo, useState } from "react";
import { recordPayment } from "@/app/actions";
import { formatTTD, fromCents } from "@/lib/money";

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

export function PaymentForm({
  customers,
  invoices,
  sales = [],
  initialInvoiceId = "",
  initialSaleId = "",
}: {
  customers: { id: string; name: string }[];
  invoices: InvoiceOption[];
  sales?: SaleOption[];
  initialInvoiceId?: string;
  initialSaleId?: string;
}) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [saleId, setSaleId] = useState(initialSaleId);

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId) || null,
    [invoices, invoiceId],
  );

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === saleId) || null,
    [sales, saleId],
  );

  const selectedReceivable = selectedInvoice || selectedSale;

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = invoices.find((i) => i.id === initialInvoiceId);
      if (inv) {
        setInvoiceId(inv.id);
        setSaleId("");
        setCustomerId(inv.customerId);
      }
    } else if (initialSaleId) {
      const sale = sales.find((s) => s.id === initialSaleId);
      if (sale) {
        setSaleId(sale.id);
        setInvoiceId("");
        setCustomerId(sale.customerId);
      }
    }
  }, [initialInvoiceId, initialSaleId, invoices, sales]);

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    setSaleId("");
    const inv = invoices.find((i) => i.id === id);
    if (inv) setCustomerId(inv.customerId);
  }

  function onSaleChange(id: string) {
    setSaleId(id);
    setInvoiceId("");
    const sale = sales.find((s) => s.id === id);
    if (sale) setCustomerId(sale.customerId);
  }

  return (
    <form action={recordPayment} className="form-grid">
      <label className="field">
        Invoice (service)
        <select name="invoiceId" value={invoiceId} onChange={(e) => onInvoiceChange(e.target.value)}>
          <option value="">None</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number} — {inv.customerName} — {formatTTD(inv.amountDue)} due
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        POS sale
        <select name="saleId" value={saleId} onChange={(e) => onSaleChange(e.target.value)}>
          <option value="">None</option>
          {sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {sale.number} — {sale.customerName} — {formatTTD(sale.amountDue)} due
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
            if (selectedSale && selectedSale.customerId !== e.target.value) {
              setSaleId("");
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
          key={selectedReceivable?.id ?? "unallocated"}
          defaultValue={selectedReceivable ? fromCents(selectedReceivable.amountDue) : ""}
        />
      </label>
      <label className="field">
        Method
        <select name="method" defaultValue="BANK">
          <option value="BANK">Bank</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="DEBIT">Debit card</option>
          <option value="CREDIT">Credit card</option>
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
