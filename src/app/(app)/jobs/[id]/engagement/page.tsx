import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { syncJobStatus } from "@/app/actions";
import { JobEngagementCalendar } from "@/components/JobEngagementCalendar";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function JobEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforceTierPath("/jobs");
  const { id } = await params;
  const { companyId } = await requireCompany();
  const job = await prisma.job.findFirst({ where: { id, companyId } });
  if (!job) notFound();

  await syncJobStatus(job.id, companyId);

  return (
    <div className="stack">
      <PageHeader
        title="Period of engagement"
        description={`${job.number} — ${job.title}`}
        actions={
          <Link className="btn btn-secondary" href={`/jobs/${job.id}`}>
            Back to job
          </Link>
        }
      />
      <Panel style={{ padding: "1.25rem", maxWidth: 560 }}>
        <JobEngagementCalendar
          jobId={job.id}
          jobNumber={job.number}
          initialStart={toIsoDate(job.startDate)}
          initialEnd={toIsoDate(job.endDate)}
        />
      </Panel>
    </div>
  );
}
