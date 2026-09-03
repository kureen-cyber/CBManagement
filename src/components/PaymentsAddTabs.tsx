"use client";

import { useState } from "react";
import { SalaryPaymentForm } from "@/components/SalaryPaymentForm";
import { PaymentForm } from "@/components/PaymentForm";

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

export function PaymentsAddTabs({
  employees,
  customers,
  suppliers,
  invoices,
  sales,
}: {
  employees: { id: string; name: string; systemRole?: string | null }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  invoices: InvoiceOption[];
  sales: SaleOption[];
}) {
  const [tab, setTab] = useState<"salary" | "operational">("operational");
  const [open, setOpen] = useState(false);

  function openTab(next: "salary" | "operational") {
    setTab(next);
    setOpen(true);
  }

  return (
    <>
      <div className="inventory-top-tabs" role="tablist" aria-label="Add payment type">
        <button
          type="button"
          role="tab"
          aria-selected={open && tab === "salary"}
          className={open && tab === "salary" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => openTab("salary")}
        >
          Add Salary Payments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={open && tab === "operational"}
          className={open && tab === "operational" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => openTab("operational")}
        >
          Add Operational Payments
        </button>
      </div>

      {open ? (
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
          onClick={() => setOpen(false)}
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
                {tab === "salary" ? "Add salary payment" : "Add operational payment"}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {tab === "salary" ? (
              <SalaryPaymentForm employees={employees} />
            ) : (
              <PaymentForm
                customers={customers}
                suppliers={suppliers}
                invoices={invoices}
                sales={sales}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
