import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromCents } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { parseVariableOptions } from "@/lib/product-variables";

export const dynamic = "force-dynamic";

/** CSV export of stock inventory, one row per item or variable option. */
export async function GET() {
  const { companyId } = await requireCompany();
  const products = await prisma.product.findMany({
    where: { companyId, isService: false },
    orderBy: { name: "asc" },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });

  const header = [
    "Name",
    "Option",
    "SKU",
    "Category",
    "Unit",
    "Stock Qty",
    "Min Stock",
    "Unit Cost (TTD)",
    "Unit Price (TTD)",
    "Status",
  ];

  const rows: string[] = [];
  for (const p of products) {
    const firstVar = p.variables[0];
    const options = firstVar ? parseVariableOptions(firstVar.options) : [];
    if (options.length) {
      for (const o of options) {
        const qty = o.qty;
        const min = o.minStock && o.minStock > 0 ? o.minStock : p.minStock;
        const low = p.trackStock && qty <= min;
        const cost = o.unitCost && o.unitCost > 0 ? o.unitCost : p.unitCost;
        const price = o.unitPrice && o.unitPrice > 0 ? o.unitPrice : p.unitPrice;
        rows.push(
          [
            csv(p.name),
            csv(o.label),
            csv(o.sku || ""),
            csv(p.category || "General"),
            csv(p.unit),
            String(qty),
            String(min),
            fromCents(cost).toFixed(2),
            fromCents(price).toFixed(2),
            low ? "LOW STOCK" : "OK",
          ].join(","),
        );
      }
    } else {
      const low = p.trackStock && p.stockQty <= p.minStock;
      rows.push(
        [
          csv(p.name),
          "",
          csv(p.sku || ""),
          csv(p.category || "General"),
          csv(p.unit),
          String(p.stockQty),
          String(p.minStock),
          fromCents(p.unitCost).toFixed(2),
          fromCents(p.unitPrice).toFixed(2),
          low ? "LOW STOCK" : "OK",
        ].join(","),
      );
    }
  }

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
