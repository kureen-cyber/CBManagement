import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import {
  FREE_RETAIL_MAX_STORES,
  STANDARD_MAX_STORES,
  isFreeRetailTier,
  parsePlanTier,
  type PlanTier,
} from "@/lib/tier";

export const POS_STORE_COOKIE = "cbm_pos_store";

export function maxStoresForTier(tier: PlanTier): number {
  return isFreeRetailTier(tier) ? FREE_RETAIL_MAX_STORES : STANDARD_MAX_STORES;
}

/** Seed the shared default category names onto a store (idempotent if already populated). */
export async function seedDefaultCategoriesForStore(companyId: string, storeId: string) {
  const count = await prisma.inventoryCategory.count({
    where: { companyId, storeId },
  });
  if (count > 0) return;
  const names = PRODUCT_CATEGORIES.filter(Boolean).slice(0, 12);
  if (!names.length) return;
  await prisma.inventoryCategory.createMany({
    data: names.map((name) => ({ companyId, storeId, name })),
    skipDuplicates: true,
  });
}

/**
 * Ensure the company has at least one store and attach legacy
 * registers/categories that have no storeId yet.
 */
export async function ensureStoresForCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { inventoryViewMode: true },
  });

  let stores = await prisma.store.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (stores.length === 0) {
    const main = await prisma.store.create({
      data: {
        companyId,
        name: "Main store",
        inventoryViewMode: company?.inventoryViewMode === "list" ? "list" : "card",
        sortOrder: 0,
      },
    });
    stores = [main];
  }

  const mainId = stores[0]!.id;

  await prisma.posRegister.updateMany({
    where: { companyId, storeId: null },
    data: { storeId: mainId },
  });

  await prisma.inventoryCategory.updateMany({
    where: { companyId, storeId: null },
    data: { storeId: mainId },
  });

  // Every store gets the same default category list when empty
  for (const store of stores) {
    await seedDefaultCategoriesForStore(companyId, store.id);
  }

  return prisma.store.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function duplicateStoreFromSource(opts: {
  companyId: string;
  planTier: string;
  name: string;
  sourceStoreId: string;
}) {
  const tier = parsePlanTier(opts.planTier);
  const max = maxStoresForTier(tier);
  const existingCount = await prisma.store.count({ where: { companyId: opts.companyId } });
  if (existingCount >= max) {
    return { error: `Your plan allows up to ${max} store${max === 1 ? "" : "s"}` };
  }

  const name = opts.name.trim();
  if (!name) return { error: "Enter a store name" };

  const clash = await prisma.store.findFirst({
    where: { companyId: opts.companyId, name: { equals: name, mode: "insensitive" } },
  });
  if (clash) return { error: "A store with that name already exists" };

  const source = await prisma.store.findFirst({
    where: { id: opts.sourceStoreId, companyId: opts.companyId },
    include: {
      posRegisters: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!source) return { error: "Source store not found" };

  const maxSort = await prisma.store.aggregate({
    where: { companyId: opts.companyId },
    _max: { sortOrder: true },
  });

  // Category list defaults across stores (system defaults), not a copy of
  // the first store's customized categories. Registers + inventory view still copy.
  const defaultCategoryNames = PRODUCT_CATEGORIES.filter(Boolean).slice(0, 12);

  const created = await prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        companyId: opts.companyId,
        name,
        inventoryViewMode: source.inventoryViewMode,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    if (source.posRegisters.length) {
      await tx.posRegister.createMany({
        data: source.posRegisters.map((r) => ({
          companyId: opts.companyId,
          storeId: store.id,
          name: r.name,
          sortOrder: r.sortOrder,
        })),
      });
    } else {
      await tx.posRegister.create({
        data: {
          companyId: opts.companyId,
          storeId: store.id,
          name: "Front counter",
          sortOrder: 0,
        },
      });
    }

    if (defaultCategoryNames.length) {
      await tx.inventoryCategory.createMany({
        data: defaultCategoryNames.map((name) => ({
          companyId: opts.companyId,
          storeId: store.id,
          name,
        })),
        skipDuplicates: true,
      });
    }

    return store;
  });

  return { ok: true as const, store: created };
}
