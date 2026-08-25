"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignEmployeeToJob, removeJobEmployee, updateJobEmployee } from "@/app/actions";
import { formatTTD, fromCents } from "@/lib/money";
import { Panel } from "@/components/ui";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  hourlyRate: number;
};

type Assignment = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  hourlyRate: number;
  hoursRequired: number;
};

export function JobAssignEmployeesPanel({
  jobId,
  jobNumber,
  employees,
  assignments,
}: {
  jobId: string;
  jobNumber: string;
  employees: EmployeeOption[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hoursRequired, setHoursRequired] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId],
  );

  const assignedIds = new Set(assignments.map((a) => a.employeeId));
  const available = employees.filter((e) => !assignedIds.has(e.id));

  function refresh() {
    router.refresh();
  }

  function onEmployeePick(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    if (emp) setHourlyRate(String(fromCents(emp.hourlyRate)));
  }

  function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeId) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("jobId", jobId);
    fd.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await assignEmployeeToJob(fd);
        setEmployeeId("");
        setHourlyRate("");
        setHoursRequired("");
        (e.target as HTMLFormElement).reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign employee");
      }
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateJobEmployee(fd);
        setEditingId(null);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update assignment");
      }
    });
  }

  return (
    <div className="stack">
      {error ? (
        <div className="info-banner" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Assign employees</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
          Choose who is working job {jobNumber}. Set their hourly rate and hours required for this
          job — defaults come from the employee profile.
        </p>
        <form className="form-grid" onSubmit={onAssign} autoComplete="off">
          <label className="field">
            Employee
            <select
              name="employeeId"
              value={employeeId}
              onChange={(e) => onEmployeePick(e.target.value)}
              required
              disabled={available.length === 0}
            >
              <option value="" disabled>
                {available.length ? "Select employee…" : "All active employees assigned"}
              </option>
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                  {e.role ? ` — ${e.role}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Hourly rate (TT$)
            <input
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder={selectedEmployee ? String(fromCents(selectedEmployee.hourlyRate)) : "0.00"}
            />
          </label>
          <label className="field">
            Hours required
            <input
              name="hoursRequired"
              type="number"
              step="0.25"
              min="0"
              value={hoursRequired}
              onChange={(e) => setHoursRequired(e.target.value)}
              placeholder="e.g. 40"
            />
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit" disabled={pending || !employeeId}>
              {pending ? "Saving…" : "Assign employee"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Rate / hr</th>
              <th>Hours</th>
              <th>Labour cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) =>
              editingId === a.id ? (
                <tr key={a.id}>
                  <td colSpan={6}>
                    <form className="form-grid" onSubmit={onUpdate} autoComplete="off">
                      <input type="hidden" name="id" value={a.id} />
                      <label className="field">
                        Employee
                        <input value={`${a.firstName} ${a.lastName}`} readOnly disabled />
                      </label>
                      <label className="field">
                        Hourly rate (TT$)
                        <input
                          name="hourlyRate"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          defaultValue={fromCents(a.hourlyRate)}
                        />
                      </label>
                      <label className="field">
                        Hours required
                        <input
                          name="hoursRequired"
                          type="number"
                          step="0.25"
                          min="0"
                          required
                          defaultValue={a.hoursRequired}
                        />
                      </label>
                      <div className="full row" style={{ gap: "0.5rem" }}>
                        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={a.id}>
                  <td>
                    <strong>
                      {a.firstName} {a.lastName}
                    </strong>
                  </td>
                  <td className="muted">{a.role ?? "—"}</td>
                  <td className="money">{formatTTD(a.hourlyRate)}/hr</td>
                  <td>{a.hoursRequired}h</td>
                  <td className="money">{formatTTD(Math.round(a.hourlyRate * a.hoursRequired))}</td>
                  <td>
                    <div className="row" style={{ gap: "0.35rem", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingId(a.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", a.id);
                          startTransition(async () => {
                            try {
                              await removeJobEmployee(fd);
                              refresh();
                            } catch (err) {
                              setError(
                                err instanceof Error ? err.message : "Could not remove assignment",
                              );
                            }
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No employees assigned to this job yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
