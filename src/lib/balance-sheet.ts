import { prisma } from "@/lib/prisma";
import { fetchBankLedger } from "@/lib/bank-ledger";
import { fetchOutstandingReceivables } from "@/lib/receivables";
import { fetchOutstandingPayables, payablesTotal } from "@/lib/payables";
import { onHandInventoryValueCents, fillUnitCostFromMovements, type ValuedProduct } from "@/lib/inventory-valuation";
import { parseVariableOptions } from "@/lib/product-variables";

export type BalanceSheetLine = {
  id: string;
  label: string;
  amount: number;
  kind: "section" | "line" | "total";
  indent?: boolean;
};

export type BalanceSheet = {
  businessName: string;
  asOfLabel: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

function line(id: string, label: string, amount: number, kind: "line" | "total" = "line", indent = true): BalanceSheetLine {
  return { id, label, amount, kind, indent };
}

function section(id: string, label: string): BalanceSheetLine {
  return { id, label, amount: 0, kind: "section" };
}

export async function fetchBalanceSheet(
  companyId: string,
  businessName: string,
  asOf: Date = new Date(),
): Promise<BalanceSheet> {
  const [bank, receivables, payables, products, costMoves] = await Promise.all([
    fetchBankLedger(companyId),
    fetchOutstandingReceivables(companyId),
    fetchOutstandingPayables(companyId),
    prisma.product.findMany({
      where: { companyId, trackStock: true, isService: false },
      select: {
        id: true,
        stockQty: true,
        unitCost: true,
        variables: { orderBy: { sortOrder: "asc" }, select: { name: true, options: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        product: { companyId, trackStock: true, isService: false },
        unitCost: { gt: 0 },
      },
      select: { productId: true, unitCost: true, createdAt: true },
    }),
  ]);

  const valuedProducts: ValuedProduct[] = fillUnitCostFromMovements(
    products.map((p) => ({
      id: p.id,
      stockQty: p.stockQty,
      unitCost: p.unitCost,
      variables: p.variables.map((v) => ({
        name: v.name,
        options: parseVariableOptions(v.options),
      })),
    })),
    costMoves,
  );

  const cash = Math.max(0, bank.balance);
  const accountsReceivable = receivables.reduce((s, r) => s + r.balance, 0);
  const inventory = onHandInventoryValueCents(valuedProducts);
  const accountsPayable = payablesTotal(payables);

  const totalAssets = cash + accountsReceivable + inventory;
  const totalLiabilities = accountsPayable;
  const ownersEquity = totalAssets - totalLiabilities;

  const asOfLabel = asOf.toLocaleDateString("en-TT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const assets: BalanceSheetLine[] = [
    section("assets", "Assets"),
    line("cash", "Cash and bank", cash),
    line("ar", "Accounts receivable", accountsReceivable),
    line("inventory", "Inventory total", inventory),
    line("total-assets", "Total assets", totalAssets, "total", false),
  ];

  const liabilities: BalanceSheetLine[] = [
    section("liabilities", "Liabilities"),
    line("ap", "Accounts payable", accountsPayable),
    line("total-liabilities", "Total liabilities", totalLiabilities, "total", false),
  ];

  const equity: BalanceSheetLine[] = [
    section("equity", "Equity"),
    line("owners-equity", "Owner's equity", ownersEquity),
    line("total-equity", "Total equity", ownersEquity, "total", false),
  ];

  return {
    businessName,
    asOfLabel,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity: ownersEquity,
  };
}
