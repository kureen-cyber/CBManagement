import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { createSupplier } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await enforceTierPath("/suppliers");
  const { companyId } = await requireCompany();
  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, expenses: true } } },
  });

  return (
    <div className="stack">
      <PageHeader title="Suppliers" description="Who you buy from." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createSupplier} className="form-grid" autoComplete="off">
          <label className="field">Name<input name="name" required autoComplete="organization" /></label>
          <label className="field">Phone<input name="phone" autoComplete="off" /></label>
          <label className="field">Email<input name="email" type="email" autoComplete="off" /></label>
          <label className="field">Address<input name="address" autoComplete="off" /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Save supplier</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Products</th><th>Expenses</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td className="muted">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                <td>{s._count.products}</td>
                <td>{s._count.expenses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
