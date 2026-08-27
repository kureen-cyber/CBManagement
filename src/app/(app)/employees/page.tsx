import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { createEmployee } from "@/app/actions";
import { AddEntityTab } from "@/components/AddEntityTab";
import { EmployeeFormFields } from "@/components/EmployeeFormFields";
import { PageHeader, Panel } from "@/components/ui";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const { companyId } = await requireCompany();
  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { timeEntries: { take: 3, orderBy: { date: "desc" } } },
  });

  return (
    <div className="stack">
      <PageHeader
        title="Employees"
        description="Staff registry — open an employee to clock in/out and review working records."
      />
      <AddEntityTab label="Add employee" wide>
        <form action={createEmployee} className="form-grid" autoComplete="off">
          <EmployeeFormFields />
          <div className="full">
            <button className="btn btn-primary" type="submit">
              Save employee
            </button>
          </div>
        </form>
      </AddEntityTab>
      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Engaged</th>
              <th>Rate</th>
              <th>Recent hours</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/${e.id}`}>
                    <strong>
                      {e.firstName} {e.lastName}
                    </strong>
                  </Link>
                </td>
                <td>{e.role ?? "—"}</td>
                <td className="muted">
                  {e.dateOfEngagement ? formatAppDate(e.dateOfEngagement) : "—"}
                </td>
                <td className="money">
                  {e.hourlyRate > 0 ? `${formatTTD(e.hourlyRate)}/hr` : "No rate"}
                </td>
                <td className="muted">
                  {e.timeEntries.length
                    ? e.timeEntries.map((t) => `${t.hours}h`).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No employees yet — use Add employee.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
