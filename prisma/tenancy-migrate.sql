CREATE TABLE IF NOT EXISTS "CompanyMember" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMember_userId_key" ON "CompanyMember"("userId");
CREATE INDEX IF NOT EXISTS "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

DO $$ BEGIN
  ALTER TABLE "CompanyMember"
    ADD CONSTRAINT "CompanyMember_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

DO $$
DECLARE
  cid TEXT;
BEGIN
  SELECT id INTO cid FROM "Company" ORDER BY "createdAt" ASC LIMIT 1;
  IF cid IS NULL THEN
    cid := md5(random()::text || clock_timestamp()::text);
    INSERT INTO "Company" (id, name, currency, "vatRate", "taxEnabled", "businessType", theme, language, "homeLayout", "receiptPrinting", "createdAt", "updatedAt")
    VALUES (cid, 'Legacy Business', 'TTD', 0.125, true, 'BOTH', 'light', 'en', 'RETAIL', true, NOW(), NOW());
  END IF;

  UPDATE "Customer" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Supplier" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Product" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Employee" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Quotation" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Job" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Invoice" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Payment" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Expense" SET "companyId" = cid WHERE "companyId" IS NULL;
  UPDATE "Sale" SET "companyId" = cid WHERE "companyId" IS NULL;
END $$;

ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Quotation" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Customer_companyId_idx" ON "Customer"("companyId");
CREATE INDEX IF NOT EXISTS "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX IF NOT EXISTS "Product_companyId_idx" ON "Product"("companyId");
CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX IF NOT EXISTS "Quotation_companyId_idx" ON "Quotation"("companyId");
CREATE INDEX IF NOT EXISTS "Job_companyId_idx" ON "Job"("companyId");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx" ON "Invoice"("companyId");
CREATE INDEX IF NOT EXISTS "Payment_companyId_idx" ON "Payment"("companyId");
CREATE INDEX IF NOT EXISTS "Expense_companyId_idx" ON "Expense"("companyId");
CREATE INDEX IF NOT EXISTS "Sale_companyId_idx" ON "Sale"("companyId");

-- Drop global unique on document numbers, add per-company unique
ALTER TABLE "Quotation" DROP CONSTRAINT IF EXISTS "Quotation_number_key";
ALTER TABLE "Job" DROP CONSTRAINT IF EXISTS "Job_number_key";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_number_key";
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_number_key";

DO $$ BEGIN
  ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_number_key" UNIQUE ("companyId", "number");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_number_key" UNIQUE ("companyId", "number");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_number_key" UNIQUE ("companyId", "number");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_number_key" UNIQUE ("companyId", "number");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FKs from tenant tables to Company
DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
