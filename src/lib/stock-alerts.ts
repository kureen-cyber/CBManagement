import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function notifyOutOfStockAttempt(opts: {
  companyId: string;
  companyName: string;
  toEmail: string | null | undefined;
  productName: string;
  requestedQty: number;
  availableQty: number;
}) {
  const to = String(opts.toEmail || "").trim();
  if (!to) return { ok: false, skipped: true as const };

  const subject = `[CBManagement] Out of stock attempt — ${opts.productName}`;
  const text = [
    `Business: ${opts.companyName}`,
    ``,
    `A cashier tried to sell an unavailable item:`,
    `• Item: ${opts.productName}`,
    `• Requested: ${opts.requestedQty}`,
    `• Available: ${opts.availableQty}`,
    ``,
    `Enable restocking in Inventory, or adjust the ticket.`,
    ``,
    `— Complete Business Management (CBManagement)`,
  ].join("\n");

  return sendEmail({ to, subject, text });
}

export async function sendWeeklyLowStockDigest(opts: {
  companyId: string;
  companyName: string;
  toEmail: string;
}) {
  const low = await prisma.product.findMany({
    where: {
      companyId: opts.companyId,
      trackStock: true,
      isService: false,
      OR: [
        { stockQty: { lte: 0 } },
        // Prisma can't compare two columns easily; filter in JS below for minStock
      ],
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const allTracked = await prisma.product.findMany({
    where: {
      companyId: opts.companyId,
      trackStock: true,
      isService: false,
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const lowItems = allTracked.filter((p) => p.stockQty <= p.minStock);
  if (!lowItems.length) {
    return { ok: true, skipped: true as const, count: 0 };
  }

  const lines = lowItems.map(
    (p) =>
      `• ${p.name} — qty ${p.stockQty}${p.unit ? ` ${p.unit}` : ""} (min ${p.minStock})${
        p.stockQty <= 0 ? " [OUT OF STOCK]" : " [LOW]"
      }`,
  );

  const subject = `[CBManagement] Weekly low stock — ${opts.companyName} (${lowItems.length})`;
  const text = [
    `Weekly low-stock report for ${opts.companyName}`,
    ``,
    ...lines,
    ``,
    `Review Inventory in CBManagement to restock.`,
    ``,
    `— Complete Business Management (CBManagement)`,
  ].join("\n");

  const result = await sendEmail({ to: opts.toEmail, subject, text });
  return { ...result, count: lowItems.length, unusedZeroQuery: low.length };
}
