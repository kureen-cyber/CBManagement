import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { createSupplier } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { companyId } = await requireCompany();
  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { items: { select: { id: true } } },
  });

  return (
    <div className="stack">
      <PageHeader
        title="Suppliers"
        description="Register vendors and track what you buy from each — cost and unit (each, kg, case, etc.)."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Register supplier</h2>
        <form action={createSupplier} className="form-grid" autoComplete="off">
          <label className="field">
            Name
            <input name="name" required placeholder="Caribbean Electrical Supplies" autoComplete="organization" />
          </label>
          <label className="field">
            Address
            <input name="address" placeholder="Port of Spain, Trinidad" autoComplete="off" />
          </label>
          <label className="field">
            Contact
            <input name="contact" placeholder="868-555-0200" autoComplete="off" />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" placeholder="sales@vendor.tt" autoComplete="off" />
          </label>
          <label className="field">
            Sales rep
            <input name="salesRep" placeholder="Jane Smith" autoComplete="off" />
          </label>
          <label className="field full">
            Notes
            <textarea name="notes" rows={2} autoComplete="off" />
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit">Save supplier</button>
          </div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Contact</th>
              <th>Sales rep</th>
              <th>Supply items</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/suppliers/${s.id}`}>
                    <strong>{s.name}</strong>
                  </Link>
                  {s.address ? (
                    <div className="muted" style={{ fontSize: "0.82rem" }}>{s.address}</div>
                  ) : null}
                </td>
                <td className="muted">
                  {[s.phone, s.email].filter(Boolean).join(" · ") || "—"}
                </td>
                <td>{s.salesRep || "—"}</td>
                <td>{s.items.length}</td>
              </tr>
            ))}
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">No suppliers yet — register one above.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
