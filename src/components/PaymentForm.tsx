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
  customers = [],
  suppliers = [],
  invoices = [],
  sales = [],
  initialInvoiceId = "",
  initialSaleId = "",
  /** incoming = customer POS/Invoice; outgoing = supplier operational outflows */
  mode = "all",
}: {
  customers?: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  invoices?: InvoiceOption[];
  sales?: SaleOption[];
  initialInvoiceId?: string;
  initialSaleId?: string;
  mode?: "incoming" | "outgoing" | "all";
}) {
  const showCustomers = mode !== "outgoing";
  const showSuppliers = mode !== "incoming";

  const payees = useMemo<PayeeOption[]>(() => {
    return [
      ...(showCustomers
        ? customers.map((c) => ({ type: "customer" as const, id: c.id, name: c.name }))
        : []),
      ...(showSuppliers
        ? suppliers.map((s) => ({ type: "supplier" as const, id: s.id, name: s.name }))
        : []),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, suppliers, showCustomers, showSuppliers]);

  const [payeeKey, setPayeeKey] = useState("");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [saleId, setSaleId] = useState(initialSaleId);
  const [incomingType, setIncomingType] = useState<"POS" | "Invoice">(
    initialSaleId ? "POS" : "Invoice",
  );

  const selectedPayee = useMemo(() => {
    if (!payeeKey) return null;
    const [type, id] = payeeKey.split(":");
    return payees.find((p) => p.type === type && p.id === id) || null;
  }, [payeeKey, payees]);

  const isSupplier = selectedPayee?.type === "supplier" || mode === "outgoing";

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId) || null,
    [invoices, invoiceId],
  );

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === saleId) || null,
    [sales, saleId],
  );

  const selectedReceivable = !isSupplier
    ? incomingType === "POS"
      ? selectedSale
      : selectedInvoice
    : null;

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = invoices.find((i) => i.id === initialInvoiceId);
      if (inv) {
        setInvoiceId(inv.id);
        setSaleId("");
        setIncomingType("Invoice");
        setPayeeKey(`customer:${inv.customerId}`);
      }
    } else if (initialSaleId) {
      const sale = sales.find((s) => s.id === initialSaleId);
      if (sale) {
        setSaleId(sale.id);
        setInvoiceId("");
        setIncomingType("POS");
        setPayeeKey(`customer:${sale.customerId}`);
      }
    }
  }, [initialInvoiceId, initialSaleId, invoices, sales]);

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    setSaleId("");
    setIncomingType("Invoice");
    const inv = invoices.find((i) => i.id === id);
    if (inv) setPayeeKey(`customer:${inv.customerId}`);
  }

  function onSaleChange(id: string) {
    setSaleId(id);
    setInvoiceId("");
    setIncomingType("POS");
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

  function onIncomingTypeChange(next: "POS" | "Invoice") {
    setIncomingType(next);
    if (next === "POS") setInvoiceId("");
    else setSaleId("");
  }

  const payeeLabel =
    mode === "incoming" ? "Customer" : mode === "outgoing" ? "Supplier" : "Customer / supplier";

  return (
    <form action={recordPayment} className="form-grid">
      <input type="hidden" name="kind" value="OPERATIONAL" />
      <input type="hidden" name="payeeKey" value={payeeKey} />

      <label className="field full">
        {payeeLabel}
        <select
          name="payeeDisplay"
          required
          value={payeeKey}
          onChange={(e) => onPayeeChange(e.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          {showCustomers && customers.length > 0 ? (
            mode === "all" ? (
              <optgroup label="Customers">
                {customers.map((c) => (
                  <option key={`customer:${c.id}`} value={`customer:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              customers.map((c) => (
                <option key={`customer:${c.id}`} value={`customer:${c.id}`}>
                  {c.name}
                </option>
              ))
            )
          ) : null}
          {showSuppliers && suppliers.length > 0 ? (
            mode === "all" ? (
              <optgroup label="Suppliers">
                {suppliers.map((s) => (
                  <option key={`supplier:${s.id}`} value={`supplier:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              suppliers.map((s) => (
                <option key={`supplier:${s.id}`} value={`supplier:${s.id}`}>
                  {s.name}
                </option>
              ))
            )
          ) : null}
        </select>
      </label>

      {mode === "incoming" || (!isSupplier && mode === "all") ? (
        <>
          <label className="field">
            Type
            <select
              value={incomingType}
              onChange={(e) => onIncomingTypeChange(e.target.value as "POS" | "Invoice")}
            >
              <option value="Invoice">Invoice</option>
              <option value="POS">POS</option>
            </select>
          </label>
          {incomingType === "Invoice" ? (
            <label className="field">
              Invoice (service / job)
              <select
                name="invoiceId"
                value={invoiceId}
                required={mode === "incoming"}
                onChange={(e) => onInvoiceChange(e.target.value)}
              >
                <option value="">Select invoice</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.customerName} — {formatTTD(inv.amountDue)} due
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              POS sale
              <select
                name="saleId"
                value={saleId}
                required={mode === "incoming"}
                onChange={(e) => onSaleChange(e.target.value)}
              >
                <option value="">Select POS sale</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.number} — {sale.customerName} — {formatTTD(sale.amountDue)} due
                  </option>
                ))}
              </select>
            </label>
          )}
          {incomingType === "Invoice" ? <input type="hidden" name="saleId" value="" /> : null}
          {incomingType === "POS" ? <input type="hidden" name="invoiceId" value="" /> : null}
        </>
      ) : (
        <>
          <input type="hidden" name="invoiceId" value="" />
          <input type="hidden" name="saleId" value="" />
          <p className="muted full" style={{ margin: 0, fontSize: "0.85rem" }}>
            Supplier and stock-purchase payments are operational outflows (cash/bank). Rent and
            similar running costs can also be recorded under Expenses so they land on the income
            statement.
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
          {mode === "outgoing" || isSupplier
            ? "Record outgoing payment"
            : mode === "incoming"
              ? "Record incoming payment"
              : "Save payment"}
        </button>
      </div>
    </form>
  );
}
