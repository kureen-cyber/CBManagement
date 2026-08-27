import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD, fromCents } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { EmployeeActionTabs } from "@/components/EmployeeActionTabs";
import { EmployeePayslipRecords } from "@/components/EmployeePayslipRecords";
import { EmployeeTimeClock } from "@/components/EmployeeTimeClock";
import { PageHeader, Panel } from "@/components/ui";
import { formatAppDate } from "@/lib/timezone";
import { receiptHeaderText } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId, company } = await requireCompany();
  const employee = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      timeEntries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      payslips: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!employee) notFound();

  const hasOpenShift = employee.timeEntries.some(
    (t) => t.clockInAt && !t.clockOutAt,
  );

  const suggestedMonthlySalary =
    employee.hourlyRate > 0 ? Math.round(employee.hourlyRate * 160) : undefined;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <PageHeader
          title={`${employee.firstName} ${employee.lastName}`}
          description={[
            employee.role || null,
            employee.hourlyRate > 0 ? `${formatTTD(employee.hourlyRate)}/hr` : "No hourly rate set",
            employee.email || null,
            employee.dateOfEngagement
              ? `Engaged ${formatAppDate(employee.dateOfEngagement)}`
              : null,
            employee.active ? null : "Inactive",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Link href="/employees" className="btn btn-secondary btn-sm">
          Back to employees
        </Link>
      </div>

      <EmployeeActionTabs
        employeeId={employee.id}
        defaultEmail={employee.email}
        suggestedMonthlySalary={suggestedMonthlySalary}
        profileValues={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: employee.role || "",
          hourlyRate: fromCents(employee.hourlyRate),
          phone: employee.phone || "",
          email: employee.email || "",
          dateOfEngagement: employee.dateOfEngagement?.toISOString(),
          dateOfTermination: employee.dateOfTermination?.toISOString(),
          nisNumber: employee.nisNumber || "",
          payeNumber: employee.payeNumber || "",
          bankAccountNumber: employee.bankAccountNumber || "",
          bankName: employee.bankName || "",
          bankBranch: employee.bankBranch || "",
          active: employee.active,
        }}
        jobLetterDefaults={{
          employeeName: `${employee.firstName} ${employee.lastName}`,
          jobTitle: employee.role || "",
          startDate: employee.dateOfEngagement?.toISOString().slice(0, 10) || "",
          companyName: receiptHeaderText(company),
          companyPhone: company.businessContactNumber || "",
          companyEmail: company.businessEmail || "",
        }}
      />

      <EmployeePayslipRecords
        payslips={employee.payslips.map((p) => ({
          id: p.id,
          periodStart: p.periodStart.toISOString(),
          periodEnd: p.periodEnd.toISOString(),
          hoursWorked: p.hoursWorked,
          grossPay: p.grossPay,
          documentHtml: p.documentHtml,
          createdAt: p.createdAt.toISOString(),
        }))}
      />

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
