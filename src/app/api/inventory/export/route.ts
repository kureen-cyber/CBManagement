import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromCents } from "@/lib/money";
import { requireCompany } from "@/lib/company";

export const dynamic = "force-dynamic";

/** CSV export of stock inventory. */
export async function GET() {
  const { companyId } = await requireCompany();
  const products = await prisma.product.findMany({
    where: { companyId, isService: false },
    orderBy: { name: "asc" },
    include: { supplier: true },
  });

  const header = [
    "Name",
    "SKU",
    "Category",
    "Unit",
    "Stock Qty",
    "Min Stock",
    "Unit Cost (TTD)",
    "Unit Price (TTD)",
    "Supplier",
    "Status",
  ];

  const rows = products.map((p) => {
    const low = p.trackStock && p.stockQty <= p.minStock;
    return [
      csv(p.name),
      csv(p.sku || ""),
      csv(p.category || "General"),
      csv(p.unit),
      String(p.stockQty),
      String(p.minStock),
      fromCents(p.unitCost).toFixed(2),
      fromCents(p.unitPrice).toFixed(2),
      csv(p.supplier?.name || ""),
      low ? "LOW STOCK" : "OK",
    ].join(",");
  });

  const csvBody = [header.join(","), ...rows].join("\n");
  const filename = `cbmanagement-stock-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
