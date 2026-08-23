import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import {
  FREE_RETAIL_MAX_POS_REGISTERS,
  FREE_RETAIL_NAV,
  FREE_TIER_MAX_TRANSACTION_DAYS,
  PLAN_TIER_LABELS,
  isFreeRetailTier,
  isLocalhostDemoHost,
  isPathAllowedForTier,
  parsePlanTier,
  receiptVisibleSince,
} from "@/lib/tier";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Localhost-only verification panel for free retail tier behaviour. */
export default async function DemoTierPage() {
  const hdrs = await headers();
  if (!isLocalhostDemoHost(hdrs.get("host"))) {
    notFound();
  }

  const { company, companyId } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const since = receiptVisibleSince(planTier);

  const [registers, visibleSales, hiddenSales, sampleChecks] = await Promise.all([
    prisma.posRegister.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    prisma.sale.count({
      where: { companyId, ...(since ? { soldAt: { gte: since } } : {}) },
    }),
    since
      ? prisma.sale.count({ where: { companyId, soldAt: { lt: since } } })
      : Promise.resolve(0),
    Promise.resolve(
      FREE_RETAIL_NAV.map((item) => ({
        ...item,
        allowed: isPathAllowedForTier(planTier, item.href),
      })),
    ),
  ]);

  const blockedOk = ["/quotations", "/jobs", "/invoices", "/expenses"].map(
    (path) => ({
      path,
      blocked: !isPathAllowedForTier(planTier, path),
    }),
  );

  return (
    <div className="stack">
      <PageHeader
        title="Demo · Free Retail tier"
        description="Localhost-only checklist. This page 404s on production hosts."
      />

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Current company</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.6 }}>
          <li>
            Business: <strong>{company.name}</strong>
          </li>
          <li>
            Business type: <strong>{company.businessType}</strong>
          </li>
          <li>
            Plan tier: <strong>{PLAN_TIER_LABELS[planTier]}</strong> ({planTier})
          </li>
          <li>
            Free retail active: <strong>{isFreeRetailTier(planTier) ? "yes" : "no"}</strong>
          </li>
        </ul>
      </Panel>

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Allowed modules</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Nav</th>
              <th>Path</th>
              <th>Allowed</th>
            </tr>
          </thead>
          <tbody>
            {sampleChecks.map((row) => (
              <tr key={row.href}>
                <td>{row.label}</td>
                <td>
                  <code>{row.href}</code>
                </td>
                <td>{row.allowed ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ fontSize: "1rem" }}>Blocked for Free Retail</h3>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {blockedOk.map((row) => (
            <li key={row.path}>
              <code>{row.path}</code> — {row.blocked ? "blocked ✓" : "NOT blocked ✗"}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>POS registers</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Free Retail max: {FREE_RETAIL_MAX_POS_REGISTERS}. Configure in{" "}
          <Link href="/settings?tab=pos">Settings → POS registers</Link>.
        </p>
        {registers.length === 0 ? (
          <p>No registers named yet.</p>
        ) : (
          <ol>
            {registers.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong> <span className="muted">({r.id})</span>
              </li>
            ))}
          </ol>
        )}
        <p>
          Count: {registers.length} / {FREE_RETAIL_MAX_POS_REGISTERS}{" "}
          {registers.length <= FREE_RETAIL_MAX_POS_REGISTERS ? "✓" : "over limit ✗"}
        </p>
      </Panel>

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Receipt retention</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.6 }}>
          <li>Window: {FREE_TIER_MAX_TRANSACTION_DAYS} days</li>
          <li>Visible sales (in window): {visibleSales}</li>
          <li>Hidden / expired sales: {hiddenSales}</li>
          <li>
            Cutoff: {since ? since.toISOString() : "n/a (standard tier keeps all)"}
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          <Link className="btn btn-secondary btn-sm" href="/pos">
            Open POS
          </Link>
        </p>
      </Panel>
    </div>
  );
}
