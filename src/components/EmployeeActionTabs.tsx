"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEmployee } from "@/app/actions";
import {
  createEmployeePayslip,
  emailEmployeeJobLetter,
  emailEmployeePayslip,
  previewEmployeeJobLetter,
  previewEmployeePayslip,
} from "@/app/actions/employee-documents";
import { EmployeeFormFields, type EmployeeFormValues } from "@/components/EmployeeFormFields";
import { formatTTD, fromCents } from "@/lib/money";
import { PAY_FREQUENCIES, EMPLOYMENT_BASIS_OPTIONS, PRONOUN_OPTIONS, type EmploymentBasis, type EmployeePronoun, type PayFrequency } from "@/lib/employee-banks";

type TabId = "profile" | "job-letter" | "payslip";

function printHtml(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function EmployeeActionTabs({
  employeeId,
  defaultEmail,
  profileValues,
  suggestedMonthlySalary,
  jobLetterDefaults,
}: {
  employeeId: string;
  defaultEmail?: string | null;
  profileValues: EmployeeFormValues;
  suggestedMonthlySalary?: number;
  jobLetterDefaults: {
    employeeName: string;
    jobTitle: string;
    startDate: string;
    companyName: string;
    companyPhone: string;
    companyEmail: string;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [salary, setSalary] = useState(
    suggestedMonthlySalary ? String(fromCents(suggestedMonthlySalary)) : "",
  );
  const [frequency, setFrequency] = useState<PayFrequency>("monthly");
  const [jobTitle, setJobTitle] = useState(jobLetterDefaults.jobTitle);
  const [startDate, setStartDate] = useState(jobLetterDefaults.startDate);
  const [idNumber, setIdNumber] = useState("");
  const [employmentBasis, setEmploymentBasis] = useState<EmploymentBasis>("full-time");
  const [pronoun, setPronoun] = useState<EmployeePronoun>("they");
  const [employerName, setEmployerName] = useState("");
  const [employerTitle, setEmployerTitle] = useState("");
  const [companyPhone, setCompanyPhone] = useState(jobLetterDefaults.companyPhone);
  const [companyEmail, setCompanyEmail] = useState(jobLetterDefaults.companyEmail);
  const [jobLetterHtml, setJobLetterHtml] = useState<string | null>(null);

  const bounds = useMemo(() => monthBounds(), []);
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [nisDeduction, setNisDeduction] = useState("");
  const [payeDeduction, setPayeDeduction] = useState("");
  const [payslipHours, setPayslipHours] = useState(0);
  const [payslipGrossCents, setPayslipGrossCents] = useState(0);
  const [payslipLoaded, setPayslipLoaded] = useState(false);
  const [payslipHtml, setPayslipHtml] = useState<string | null>(null);
  const [savedPayslipId, setSavedPayslipId] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState(defaultEmail || "");

  const payslipPeriodLabel =
    periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : "—";
  const payslipNetCents = Math.max(
    0,
    payslipGrossCents - Math.round((Number(nisDeduction) || 0) * 100) - Math.round((Number(payeDeduction) || 0) * 100),
  );

  function closeModal() {
    setTab(null);
    setError(null);
    setMessage(null);
  }

  function refresh() {
    router.refresh();
  }

  function onProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateEmployee(fd);
        refresh();
        closeModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save profile");
      }
    });
  }

  function jobLetterInput() {
    return {
      employeeId,
      salary: Number(salary) || 0,
      frequency,
      idNumber,
      employmentBasis,
      pronoun,
      employerName,
      employerTitle,
      jobTitle,
      startDate,
      companyPhone,
      companyEmail,
    };
  }

  function loadJobLetterPreview() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewEmployeeJobLetter(jobLetterInput());
        setJobLetterHtml(result.html);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build job letter");
      }
    });
  }

  function onEmailJobLetter() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await emailEmployeeJobLetter({
        ...jobLetterInput(),
        toEmail: emailTo,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Job letter sent to ${result.to}`);
    });
  }

  function payslipInput() {
    return {
      employeeId,
      periodStart,
      periodEnd,
      nisDeduction: Number(nisDeduction) || 0,
      payeDeduction: Number(payeDeduction) || 0,
    };
  }

  function loadPayslipPeriod() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewEmployeePayslip(payslipInput());
        setPayslipHours(result.hoursWorked);
        setPayslipGrossCents(result.grossPayCents);
        setPayslipLoaded(true);
        setPayslipHtml(result.html);
        setSavedPayslipId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load period");
      }
    });
  }

  function onGeneratePayslip() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createEmployeePayslip(payslipInput());
        setPayslipHtml(result.documentHtml);
        setPayslipHours(result.hoursWorked);
        setPayslipGrossCents(result.grossPayCents);
        setPayslipLoaded(true);
        setSavedPayslipId(result.id);
        setMessage(
          `Payslip saved — ${result.hoursWorked.toFixed(2)} h, ${formatTTD(result.grossPayCents)} gross, ${formatTTD(result.netPayCents)} net`,
        );
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate payslip");
      }
    });
  }

  function onPreviewPayslip() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewEmployeePayslip(payslipInput());
        setPayslipHours(result.hoursWorked);
        setPayslipGrossCents(result.grossPayCents);
        setPayslipLoaded(true);
        setPayslipHtml(result.html);
        setSavedPayslipId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not preview payslip");
      }
    });
  }

  function onEmailPayslip() {
    if (!savedPayslipId) {
      setError("Generate and save the payslip first");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await emailEmployeePayslip({
        payslipId: savedPayslipId,
        toEmail: emailTo,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Payslip sent to ${result.to}`);
    });
  }

  useEffect(() => {
    if (tab === "job-letter") {
      loadJobLetterPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Edit profile" },
    { id: "job-letter", label: "Generate Job Letter" },
    { id: "payslip", label: "Generate Payslip" },
  ];

  return (
    <>
      <div className="inventory-top-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "settings-subtab active" : "settings-subtab"}
            onClick={() => {
              setTab(t.id);
              setError(null);
              setMessage(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={closeModal}
        >
          <div
            className="panel add-entity-modal"
            style={{
              padding: "1.25rem",
              width: "min(920px, 100%)",
              maxHeight: "min(90vh, 920px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}
            >
              <h3 style={{ margin: 0 }}>
                {tabs.find((t) => t.id === tab)?.label}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeModal}>
                Close
              </button>
            </div>

            {error ? (
              <div
                className="info-banner"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "0.75rem" }}
              >
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="badge badge-ok" style={{ marginBottom: "0.75rem" }}>
                {message}
              </div>
            ) : null}

            {tab === "profile" ? (
              <form className="form-grid" autoComplete="off" onSubmit={onProfileSubmit}>
                <input type="hidden" name="id" value={employeeId} />
                <EmployeeFormFields showActive values={profileValues} />
                <div className="full">
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </form>
            ) : null}

            {tab === "job-letter" ? (
              <div className="stack">
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Pre-filled fields come from the employee profile and business settings. Edit any
                  value below before printing or emailing — changes apply to this letter only.
                </p>
                <div className="form-grid">
                  <label className="field">
                    Employee name
                    <input value={jobLetterDefaults.employeeName} readOnly />
                  </label>
                  <label className="field">
                    Company / business name
                    <input value={jobLetterDefaults.companyName} readOnly />
                  </label>
                  <label className="field">
                    Job title
                    <input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Position on the letter"
                    />
                  </label>
                  <label className="field">
                    Start date
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    National ID / Passport
                    <input
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="Optional — leave blank if not required"
                    />
                  </label>
                  <label className="field">
                    Employment basis
                    <select
                      value={employmentBasis}
                      onChange={(e) => setEmploymentBasis(e.target.value as EmploymentBasis)}
                    >
                      {EMPLOYMENT_BASIS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Pronoun
                    <select
                      value={pronoun}
                      onChange={(e) => setPronoun(e.target.value as EmployeePronoun)}
                    >
                      {PRONOUN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Salary (TT$)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Pay frequency
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as PayFrequency)}
                    >
                      {PAY_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Employer / manager name
                    <input
                      value={employerName}
                      onChange={(e) => setEmployerName(e.target.value)}
                      placeholder="Signatory full name"
                    />
                  </label>
                  <label className="field">
                    Signatory title
                    <input
                      value={employerTitle}
                      onChange={(e) => setEmployerTitle(e.target.value)}
                      placeholder="e.g. Managing Director"
                    />
                  </label>
                  <label className="field">
                    Company telephone
                    <input
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="From business settings"
                    />
                  </label>
                  <label className="field">
                    Company email
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="From business settings"
                    />
                  </label>
                  <label className="field">
                    Email letter to
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="employee@email.com"
                    />
                  </label>
                </div>
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={loadJobLetterPreview}
                  >
                    Refresh preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending || !jobLetterHtml}
                    onClick={() => jobLetterHtml && printHtml(jobLetterHtml)}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending || !emailTo.trim()}
                    onClick={onEmailJobLetter}
                  >
                    Email
                  </button>
                </div>
                {jobLetterHtml ? (
                  <iframe
                    title="Job letter preview"
                    srcDoc={jobLetterHtml}
                    style={{
                      width: "100%",
                      minHeight: "420px",
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      background: "#fff",
                    }}
                  />
                ) : (
                  <p className="muted">Building preview…</p>
                )}
              </div>
            ) : null}

            {tab === "payslip" ? (
              <div className="stack">
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Choose the pay period, then load clock records into the table. Enter NIS and PAYE
                  amounts in the values row — net pay is gross minus those deductions.
                </p>
                <div className="form-grid">
                  <label className="field">
                    Period start
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => {
                        setPeriodStart(e.target.value);
                        setPayslipLoaded(false);
                      }}
                    />
                  </label>
                  <label className="field">
                    Period end
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => {
                        setPeriodEnd(e.target.value);
                        setPayslipLoaded(false);
                      }}
                    />
                  </label>
                  <label className="field">
                    Email to
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="employee@email.com"
                    />
                  </label>
                </div>

                <div className="table-wrap list-dense">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Hours</th>
                        <th style={{ textAlign: "right" }}>Gross Pay</th>
                        <th>NIS</th>
                        <th>PAYE</th>
                        <th style={{ textAlign: "right" }}>Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td />
                        <td />
                        <td />
                        <td>{profileValues.nisNumber?.trim() || "—"}</td>
                        <td>{profileValues.payeNumber?.trim() || "—"}</td>
                        <td />
                      </tr>
                      <tr>
                        <td>{payslipPeriodLabel}</td>
                        <td>{payslipLoaded ? payslipHours.toFixed(2) : "—"}</td>
                        <td className="money" style={{ textAlign: "right" }}>
                          {payslipLoaded ? formatTTD(payslipGrossCents) : "—"}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={nisDeduction}
                            onChange={(e) => setNisDeduction(e.target.value)}
                            placeholder="0.00"
                            style={{ width: "100%", maxWidth: 110 }}
                            aria-label="NIS deduction amount"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={payeDeduction}
                            onChange={(e) => setPayeDeduction(e.target.value)}
                            placeholder="0.00"
                            style={{ width: "100%", maxWidth: 110 }}
                            aria-label="PAYE deduction amount"
                          />
                        </td>
                        <td className="money" style={{ textAlign: "right" }}>
                          {payslipLoaded ? formatTTD(payslipNetCents) : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={loadPayslipPeriod}
                  >
                    Load period
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={onPreviewPayslip}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending}
                    onClick={onGeneratePayslip}
                  >
                    {pending ? "Generating…" : "Generate & save payslip"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending || !payslipHtml}
                    onClick={() => payslipHtml && printHtml(payslipHtml)}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending || !savedPayslipId || !emailTo.trim()}
                    onClick={onEmailPayslip}
                  >
                    Email
                  </button>
                </div>
                {payslipHtml ? (
                  <iframe
                    title="Payslip preview"
                    srcDoc={payslipHtml}
                    style={{
                      width: "100%",
                      minHeight: "320px",
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      background: "#fff",
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
