/**
 * Restore ProductVariable.options (per-row qtys) from a Neon point-in-time branch.
 *
 * 1. In Neon Console → Branches → Create branch from parent at a time BEFORE
 *    the bad rebuild (around 2026-09-03 03:10 UTC / Sep 2 11:10pm EDT).
 * 2. Copy that branch's connection string.
 * 3. Run:
 *      set DATABASE_URL=<production>
 *      set DATABASE_URL_SNAPSHOT=<pitr-branch>
 *      npx tsx scripts/restore-variant-options-from-snapshot.ts
 *
 * Or with Vercel production env:
 *      set DATABASE_URL_SNAPSHOT=<pitr-branch>
 *      vercel env run -e production -- npx tsx scripts/restore-variant-options-from-snapshot.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  parseVariableOptions,
  sumOptionStock,
  type ProductVariableDef,
} from "../src/lib/product-variables";

function unwrap(raw: string | undefined): string {
  let v = String(raw || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const liveUrl = unwrap(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL);
const snapUrl = unwrap(process.env.DATABASE_URL_SNAPSHOT);

if (!liveUrl.startsWith("postgres") && !liveUrl.startsWith("prisma")) {
  console.error("Set DATABASE_URL (production) before running.");
  process.exit(2);
}
if (!snapUrl.startsWith("postgres") && !snapUrl.startsWith("prisma")) {
  console.error("Set DATABASE_URL_SNAPSHOT to the Neon PITR branch URL.");
  process.exit(2);
}

const live = new PrismaClient({ datasources: { db: { url: liveUrl } } });
const snap = new PrismaClient({ datasources: { db: { url: snapUrl } } });

async function main() {
  const snapVars = await snap.productVariable.findMany({
    include: { product: { select: { id: true, name: true, trackStock: true, isService: true } } },
  });

  let updated = 0;
  for (const row of snapVars) {
    const product = row.product;
    if (!product.trackStock || product.isService) continue;

    const liveRow = await live.productVariable.findFirst({
      where: { productId: product.id, name: row.name },
    });
    if (!liveRow) continue;
    if (liveRow.options === row.options) continue;

    await live.productVariable.update({
      where: { id: liveRow.id },
      data: { options: row.options },
    });
    updated += 1;
    console.log(`restored ${product.name} / ${row.name}`);
  }

  const products = await live.product.findMany({
    where: { trackStock: true, isService: false },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });

  let synced = 0;
  for (const product of products) {
    const variables: ProductVariableDef[] = product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options),
    }));
    if (!variables.length) continue;
    const nextQty = sumOptionStock(variables);
    if (Math.abs(product.stockQty - nextQty) < 1e-9) continue;
    await live.product.update({
      where: { id: product.id },
      data: { stockQty: nextQty },
    });
    synced += 1;
    console.log(`synced stockQty ${product.name} -> ${nextQty}`);
  }

  console.log(`Done. variables updated=${updated}, stockQty synced=${synced}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.all([live.$disconnect(), snap.$disconnect()]);
  });
