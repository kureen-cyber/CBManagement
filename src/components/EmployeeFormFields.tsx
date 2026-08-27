import { EMPLOYEE_BANKS } from "@/lib/employee-banks";

export type EmployeeFormValues = {
  firstName?: string;
  lastName?: string;
  role?: string;
  hourlyRate?: number;
  phone?: string;
  email?: string;
  dateOfEngagement?: string;
  dateOfTermination?: string;
  nisNumber?: string;
  payeNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  active?: boolean;
};

function dateInputValue(value?: string | Date | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function EmployeeFormFields({
  values,
  showActive,
}: {
  values?: EmployeeFormValues;
  showActive?: boolean;
}) {
  return (
    <>
      <label className="field">
        First name
        <input
          name="firstName"
          required
          defaultValue={values?.firstName || ""}
          autoComplete="off"
        />
      </label>
      <label className="field">
        Last name
        <input
          name="lastName"
          required
          defaultValue={values?.lastName || ""}
          autoComplete="off"
        />
      </label>
      <label className="field">
        Role
        <input
          name="role"
          defaultValue={values?.role || ""}
          placeholder="Electrician"
          autoComplete="off"
        />
      </label>
      <label className="field">
        Hourly rate (TT$)
        <input
          name="hourlyRate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values?.hourlyRate ?? 40}
        />
      </label>
      <label className="field">
        Phone
        <input name="phone" defaultValue={values?.phone || ""} autoComplete="off" />
      </label>
      <label className="field">
        Email
        <input
          name="email"
          type="email"
          defaultValue={values?.email || ""}
          autoComplete="off"
        />
      </label>
      <label className="field">
        Date of engagement
        <input
          name="dateOfEngagement"
          type="date"
          defaultValue={dateInputValue(values?.dateOfEngagement)}
        />
      </label>
      <label className="field">
        Date of termination
        <input
          name="dateOfTermination"
          type="date"
          defaultValue={dateInputValue(values?.dateOfTermination)}
        />
      </label>
      <label className="field">
        NIS number
        <input
          name="nisNumber"
          defaultValue={values?.nisNumber || ""}
          placeholder="National Insurance"
          autoComplete="off"
        />
      </label>
      <label className="field">
        PAYE number
        <input
          name="payeNumber"
          defaultValue={values?.payeNumber || ""}
          autoComplete="off"
        />
      </label>
      <label className="field">
        Bank account number
        <input
          name="bankAccountNumber"
          defaultValue={values?.bankAccountNumber || ""}
          autoComplete="off"
        />
      </label>
      <label className="field">
        Bank
        <select name="bankName" defaultValue={values?.bankName || ""}>
          <option value="">Select bank…</option>
          {values?.bankName &&
          !EMPLOYEE_BANKS.includes(values.bankName as (typeof EMPLOYEE_BANKS)[number]) ? (
            <option value={values.bankName}>{values.bankName}</option>
          ) : null}
          {EMPLOYEE_BANKS.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Branch
        <input name="bankBranch" defaultValue={values?.bankBranch || ""} autoComplete="off" />
      </label>
      {showActive ? (
        <label
          className="field full"
          style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}
        >
          <input name="active" type="checkbox" defaultChecked={values?.active !== false} />
          Active employee
        </label>
      ) : null}
    </>
  );
}
