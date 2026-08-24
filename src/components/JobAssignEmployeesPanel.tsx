"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignEmployeeToJob, removeJobEmployee } from "@/app/actions";
import { formatTTD } from "@/lib/money";
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

  const assignedIds = new Set(assignments.map((a) => a.employeeId));
  const available = employees.filter((e) => !assignedIds.has(e.id));

  function refresh() {
    router.refresh();
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
        (e.target as HTMLFormElement).reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign employee");
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
          Choose who is working job {jobNumber}. You can assign more than one employee.
        </p>
        <form className="form-grid" onSubmit={onAssign} autoComplete="off">
          <label className="field">
            Employee
            <select
              name="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
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
          <div className="full">
            <button className="btn btn-primary" type="submit" disabled={pending || !employeeId}>
              {pending ? "Saving…" : "Assign employee"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>
                    {a.firstName} {a.lastName}
                  </strong>
                </td>
                <td className="muted">{a.role ?? "—"}</td>
                <td className="money">{formatTTD(a.hourlyRate)}/hr</td>
                <td>
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
                          setError(err instanceof Error ? err.message : "Could not remove assignment");
                        }
                      });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
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
