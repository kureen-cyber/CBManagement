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

/** Seed starter categories onto a store when empty (used for the pilot / first store only). */
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
 * The first store is the pilot; later empty stores clone its categories.
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

  const pilot = stores[0]!;
  const pilotId = pilot.id;

  await prisma.posRegister.updateMany({
    where: { companyId, storeId: null },
    data: { storeId: pilotId },
  });

  await prisma.inventoryCategory.updateMany({
    where: { companyId, storeId: null },
    data: { storeId: pilotId },
  });

  // Pilot gets system defaults if empty; other stores clone pilot if empty
  await seedDefaultCategoriesForStore(companyId, pilotId);

  const pilotCategories = await prisma.inventoryCategory.findMany({
    where: { companyId, storeId: pilotId },
    orderBy: { name: "asc" },
  });

  for (const store of stores.slice(1)) {
    const count = await prisma.inventoryCategory.count({
      where: { companyId, storeId: store.id },
    });
    if (count > 0) continue;
    if (pilotCategories.length) {
      await prisma.inventoryCategory.createMany({
        data: pilotCategories.map((c) => ({
          companyId,
          storeId: store.id,
          name: c.name,
          color: c.color,
        })),
        skipDuplicates: true,
      });
    } else {
      await seedDefaultCategoriesForStore(companyId, store.id);
    }
  }

  return prisma.store.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Create a store from the pilot (first) store: copy inventory view, registers,
 * and category list (names + colours). Later edits stay local to each store.
 */
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

  // Always clone from the pilot (first) store when available
  const stores = await prisma.store.findMany({
    where: { companyId: opts.companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const pilotId = stores[0]?.id || opts.sourceStoreId;

  const source = await prisma.store.findFirst({
    where: { id: pilotId, companyId: opts.companyId },
    include: {
      posRegisters: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      inventoryCategories: { orderBy: { name: "asc" } },
    },
  });
  if (!source) return { error: "Pilot store not found" };

  const maxSort = await prisma.store.aggregate({
    where: { companyId: opts.companyId },
    _max: { sortOrder: true },
  });

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

    if (source.inventoryCategories.length) {
      await tx.inventoryCategory.createMany({
        data: source.inventoryCategories.map((c) => ({
          companyId: opts.companyId,
          storeId: store.id,
          name: c.name,
          color: c.color,
        })),
        skipDuplicates: true,
      });
    } else {
      const names = PRODUCT_CATEGORIES.filter(Boolean).slice(0, 12);
      if (names.length) {
        await tx.inventoryCategory.createMany({
          data: names.map((catName) => ({
            companyId: opts.companyId,
            storeId: store.id,
            name: catName,
          })),
          skipDuplicates: true,
        });
      }
    }

    return store;
  });

  return { ok: true as const, store: created };
}
