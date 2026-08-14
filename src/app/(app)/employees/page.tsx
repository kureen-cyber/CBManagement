import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { createEmployee } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

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
      <PageHeader title="Employees" description="Hourly rates and hours worked." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createEmployee} className="form-grid" autoComplete="off">
          <label className="field">First name<input name="firstName" required autoComplete="off" /></label>
          <label className="field">Last name<input name="lastName" required autoComplete="off" /></label>
          <label className="field">Role<input name="role" placeholder="Electrician" autoComplete="off" /></label>
          <label className="field">Hourly rate (TT$)<input name="hourlyRate" type="number" step="0.01" defaultValue="40" /></label>
          <label className="field">Phone<input name="phone" autoComplete="off" /></label>
          <label className="field">Email<input name="email" type="email" autoComplete="off" /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Save employee</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Employee</th><th>Role</th><th>Rate</th><th>Recent hours</th></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.firstName} {e.lastName}</strong></td>
                <td>{e.role ?? "—"}</td>
                <td className="money">{formatTTD(e.hourlyRate)}/hr</td>
                <td className="muted">
                  {e.timeEntries.length
                    ? e.timeEntries.map((t) => `${t.hours}h`).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
