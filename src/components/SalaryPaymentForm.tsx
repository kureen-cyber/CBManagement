"use client";

import { useMemo, useState } from "react";
import { recordSalaryPayment } from "@/app/actions";
import {
  MANAGER_POSITION_LABEL,
  MANAGER_SYSTEM_ROLE,
  OWNER_POSITION_LABEL,
  OWNER_SYSTEM_ROLE,
} from "@/lib/owner-drawings";

type EmployeeOption = {
  id: string;
  name: string;
  systemRole?: string | null;
};

export function SalaryPaymentForm({ employees }: { employees: EmployeeOption[] }) {
  const [payeeId, setPayeeId] = useState("");

  const { owner, manager, staff } = useMemo(() => {
    const ownerEmp = employees.find((e) => e.systemRole === OWNER_SYSTEM_ROLE);
    const managerEmp = employees.find((e) => e.systemRole === MANAGER_SYSTEM_ROLE);
    const regular = employees.filter(
      (e) => e.systemRole !== OWNER_SYSTEM_ROLE && e.systemRole !== MANAGER_SYSTEM_ROLE,
    );
    return { owner: ownerEmp, manager: managerEmp, staff: regular };
  }, [employees]);

  const isOwnerDrawing = payeeId === owner?.id;

  return (
    <form action={recordSalaryPayment} className="form-grid">
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
          {owner || manager ? (
            <optgroup label="Leadership">
              {owner ? (
                <option value={owner.id}>
                  {owner.name || OWNER_POSITION_LABEL} — owner drawings
                </option>
              ) : null}
              {manager ? (
                <option value={manager.id}>
                  {manager.name || MANAGER_POSITION_LABEL} — salary
                </option>
              ) : null}
            </optgroup>
          ) : null}
          {staff.length > 0 ? (
            <optgroup label="Employees">
              {staff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <span className="muted" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
          Owner drawings are recorded only from the Owner position. Manager and other staff
          payments count as salary.
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
          {isOwnerDrawing ? "Record owner drawing" : "Record salary payment"}
        </button>
      </div>
    </form>
  );
}
