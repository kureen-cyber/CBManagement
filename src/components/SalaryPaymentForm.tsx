"use client";

import { useState } from "react";
import { recordSalaryPayment } from "@/app/actions";
import { MANAGER_OWNER_CUSTOMER_NAME, MANAGER_OWNER_PAYEE_ID } from "@/lib/owner-drawings";

export function SalaryPaymentForm({
  employees,
  managerOwnerCustomerId,
}: {
  employees: { id: string; name: string }[];
  managerOwnerCustomerId: string;
}) {
  const [payeeId, setPayeeId] = useState("");

  return (
    <form action={recordSalaryPayment} className="form-grid">
      <input type="hidden" name="managerOwnerCustomerId" value={managerOwnerCustomerId} />
      <label className="field full">
        Employee
        <select
          name="payeeId"
          required
          value={payeeId}
          onChange={(e) => setPayeeId(e.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          <optgroup label="Owner / manager">
            <option value={MANAGER_OWNER_PAYEE_ID}>
              {MANAGER_OWNER_CUSTOMER_NAME} — owner drawings
            </option>
          </optgroup>
          {employees.length > 0 ? (
            <optgroup label="Employees">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <span className="muted" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
          Salary and owner drawings are recorded under Salary Payments — not as customer income.
        </span>
      </label>
      <label className="field">
        Amount (TT$)
        <input name="amount" type="number" step="0.01" min="0.01" required />
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
          {payeeId === MANAGER_OWNER_PAYEE_ID ? "Record owner drawing" : "Record salary payment"}
        </button>
      </div>
    </form>
  );
}
