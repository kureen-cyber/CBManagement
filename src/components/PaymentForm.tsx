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

type PayeeOption =
  | { type: "customer"; id: string; name: string }
  | { type: "supplier"; id: string; name: string };

export function PaymentForm({
  customers,
  suppliers = [],
  invoices,
  sales = [],
  initialInvoiceId = "",
  initialSaleId = "",
}: {
  customers: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  invoices: InvoiceOption[];
  sales?: SaleOption[];
  initialInvoiceId?: string;
  initialSaleId?: string;
}) {
  const payees = useMemo<PayeeOption[]>(() => {
    return [
      ...customers.map((c) => ({ type: "customer" as const, id: c.id, name: c.name })),
      ...suppliers.map((s) => ({ type: "supplier" as const, id: s.id, name: s.name })),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, suppliers]);

  const [payeeKey, setPayeeKey] = useState("");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [saleId, setSaleId] = useState(initialSaleId);

  const selectedPayee = useMemo(() => {
    if (!payeeKey) return null;
    const [type, id] = payeeKey.split(":");
    return payees.find((p) => p.type === type && p.id === id) || null;
  }, [payeeKey, payees]);

  const isSupplier = selectedPayee?.type === "supplier";

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId) || null,
    [invoices, invoiceId],
  );

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === saleId) || null,
    [sales, saleId],
  );

  const selectedReceivable = !isSupplier ? selectedInvoice || selectedSale : null;

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = invoices.find((i) => i.id === initialInvoiceId);
      if (inv) {
        setInvoiceId(inv.id);
        setSaleId("");
        setPayeeKey(`customer:${inv.customerId}`);
      }
    } else if (initialSaleId) {
      const sale = sales.find((s) => s.id === initialSaleId);
      if (sale) {
        setSaleId(sale.id);
        setInvoiceId("");
        setPayeeKey(`customer:${sale.customerId}`);
      }
    }
  }, [initialInvoiceId, initialSaleId, invoices, sales]);

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    setSaleId("");
    const inv = invoices.find((i) => i.id === id);
    if (inv) setPayeeKey(`customer:${inv.customerId}`);
  }

  function onSaleChange(id: string) {
    setSaleId(id);
    setInvoiceId("");
    const sale = sales.find((s) => s.id === id);
    if (sale) setPayeeKey(`customer:${sale.customerId}`);
  }

  function onPayeeChange(key: string) {
    setPayeeKey(key);
    const [type, id] = key.split(":");
    if (type === "supplier") {
      setInvoiceId("");
      setSaleId("");
      return;
    }
    if (selectedInvoice && selectedInvoice.customerId !== id) setInvoiceId("");
    if (selectedSale && selectedSale.customerId !== id) setSaleId("");
  }

  return (
    <form action={recordPayment} className="form-grid">
      <input type="hidden" name="kind" value="OPERATIONAL" />
      <input type="hidden" name="payeeKey" value={payeeKey} />

      <label className="field full">
        Customer / supplier
        <select name="payeeDisplay" required value={payeeKey} onChange={(e) => onPayeeChange(e.target.value)}>
          <option value="" disabled>
            Select
          </option>
          {customers.length > 0 ? (
            <optgroup label="Customers">
              {customers.map((c) => (
                <option key={`customer:${c.id}`} value={`customer:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {suppliers.length > 0 ? (
            <optgroup label="Suppliers">
              {suppliers.map((s) => (
                <option key={`supplier:${s.id}`} value={`supplier:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>

      {!isSupplier ? (
        <>
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
        </>
      ) : (
        <>
          <input type="hidden" name="invoiceId" value="" />
          <input type="hidden" name="saleId" value="" />
          <p className="muted full" style={{ margin: 0, fontSize: "0.85rem" }}>
            Supplier payments are recorded as operational outflows (not customer income).
          </p>
        </>
      )}

      <label className="field">
        Amount (TT$)
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          key={selectedReceivable?.id ?? payeeKey ?? "unallocated"}
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
          {isSupplier ? "Record supplier payment" : "Save payment"}
        </button>
      </div>
    </form>
  );
}
