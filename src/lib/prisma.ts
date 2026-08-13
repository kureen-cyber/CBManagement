import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveDatabaseUrl(): string | undefined {
  // On Vercel, SQLite must live in /tmp (writable). Copy the built DB once per instance.
  // Filename bumped so new deploys do not reuse an old /tmp copy that still has demo data.
  if (process.env.VERCEL && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:"))) {
    const target = "/tmp/cbmanagement-live.db";
    const candidates = [
      path.join(process.cwd(), "prisma", "prod.db"),
      path.join(process.cwd(), "prisma", "dev.db"),
    ];
    if (!fs.existsSync(target)) {
      const source = candidates.find((p) => fs.existsSync(p));
      if (source) {
        fs.copyFileSync(source, target);
      }
    }
    return `file:${target}`;
  }
  return process.env.DATABASE_URL;
}

const datasourceUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production" || process.env.VERCEL) {
  globalForPrisma.prisma = prisma;
}
