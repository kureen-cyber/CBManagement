import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { EmployeeTimeClock } from "@/components/EmployeeTimeClock";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const employee = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      timeEntries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!employee) notFound();

  const hasOpenShift = employee.timeEntries.some(
    (t) => t.clockInAt && !t.clockOutAt,
  );

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader
          title={`${employee.firstName} ${employee.lastName}`}
          description={[
            employee.role || null,
            employee.hourlyRate > 0 ? `${formatTTD(employee.hourlyRate)}/hr` : "No hourly rate set",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Link href="/employees" className="btn btn-secondary btn-sm">
          Back to employees
        </Link>
      </div>

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem" }}>Time clock</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
          Clock in and out to build working records.{" "}
          {employee.hourlyRate > 0
            ? "Payment is calculated from hours × hourly rate."
            : "No rate is set — enter payment for each completed period manually."}
        </p>
        <EmployeeTimeClock
          employeeId={employee.id}
          employeeRate={employee.hourlyRate}
          hasOpenShift={hasOpenShift}
          entries={employee.timeEntries.map((t) => ({
            id: t.id,
            date: t.date.toISOString(),
            clockInAt: t.clockInAt?.toISOString() ?? null,
            clockOutAt: t.clockOutAt?.toISOString() ?? null,
            hours: t.hours,
            hourlyRate: t.hourlyRate,
            paymentAmount: t.paymentAmount,
          }))}
        />
      </Panel>
    </div>
  );
}
