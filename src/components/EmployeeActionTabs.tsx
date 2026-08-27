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
import { PAY_FREQUENCIES, type PayFrequency } from "@/lib/employee-banks";

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
}: {
  employeeId: string;
  defaultEmail?: string | null;
  profileValues: EmployeeFormValues;
  suggestedMonthlySalary?: number;
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
  const [jobLetterHtml, setJobLetterHtml] = useState<string | null>(null);

  const bounds = useMemo(() => monthBounds(), []);
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [payslipHtml, setPayslipHtml] = useState<string | null>(null);
  const [savedPayslipId, setSavedPayslipId] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState(defaultEmail || "");

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

  function loadJobLetterPreview() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewEmployeeJobLetter({
          employeeId,
          salary: Number(salary) || 0,
          frequency,
        });
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
        employeeId,
        toEmail: emailTo,
        salary: Number(salary) || 0,
        frequency,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Job letter sent to ${result.to}`);
    });
  }

  function onGeneratePayslip() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createEmployeePayslip({
          employeeId,
          periodStart,
          periodEnd,
        });
        setPayslipHtml(result.documentHtml);
        setSavedPayslipId(result.id);
        setMessage(
          `Payslip saved — ${result.hoursWorked.toFixed(2)} h, ${formatTTD(result.grossPayCents)} gross`,
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
        const result = await previewEmployeePayslip({
          employeeId,
          periodStart,
          periodEnd,
        });
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
                  Review the letter pulled from this employee&apos;s profile, then set salary and pay
                  frequency before printing or emailing.
                </p>
                <div className="form-grid">
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
                    Email to
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
                  Choose the pay period, then generate a payslip from clock records. Saved payslips
                  appear under this employee&apos;s records.
                </p>
                <div className="form-grid">
                  <label className="field">
                    Period start
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Period end
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
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
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
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
                      minHeight: "420px",
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
