import { prisma } from "@/lib/prisma";
import { isOwnerDrawingPayment, isSalaryPayment } from "@/lib/owner-drawings";
import {
  fillUnitCostFromMovements,
  inventoryValueAsOfCents,
  type ValuedProduct,
} from "@/lib/inventory-valuation";
import {
  effectiveProductUnitCost,
  parseVariableOptions,
  resolveSaleUnitCost,
} from "@/lib/product-variables";

export const INCOME_STATEMENT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type IncomeStatementLineId =
  | "cashOnHandBeginning"
  | "salesRevenue"
  | "serviceIncome"
  | "otherIncome"
  | "totalRevenue"
  | "totalCashPosition"
  | "openingInventory"
  | "purchases"
  | "directLabour"
  | "closingInventory"
  | "totalCogs"
  | "grossProfit"
  | "rentExpense"
  | "utilities"
  | "salariesWages"
  | "transportation"
  | "officeSupplies"
  | "marketingAdvertising"
  | "maintenance"
  | "insurance"
  | "miscellaneousExpenses"
  | "totalOperatingExpenses"
  | "netProfit"
  | "loanPrincipalPayment"
  | "capitalPurchase"
  | "reserveEscrow"
  | "ownersWithdrawal"
  | "totalCashPaidOut"
  | "cashPosition";

export type IncomeStatementRowKind = "section" | "line" | "total" | "result";

export type IncomeStatementRow = {
  id: IncomeStatementLineId | string;
  label: string;
  kind: IncomeStatementRowKind;
  /** Per-month amounts in cents (length 12). Null for section headers. */
  months: number[] | null;
  /** Year total in cents. Null for section headers. */
  total: number | null;
  formula?: string;
};

export type MonthlyIncomeStatement = {
  businessName: string;
  year: number;
  monthLabels: string[];
  rows: IncomeStatementRow[];
};

function monthIndex(d: Date) {
  return d.getMonth();
}

function emptyMonths() {
  return Array.from({ length: 12 }, () => 0);
}

function sumMonths(months: number[]) {
  return months.reduce((s, v) => s + v, 0);
}

function addToMonth(target: number[], d: Date, amount: number) {
  const i = monthIndex(d);
  if (i >= 0 && i < 12) target[i]! += amount;
}

function matchCategory(category: string, patterns: RegExp[]) {
  const c = category.trim().toLowerCase();
  return patterns.some((p) => p.test(c));
}

/** Inventory received in-period (not via supplier invoice) counts as Purchases for COGS. */
function isInventoryPurchaseMovement(type: string, quantity: number) {
  if (quantity <= 0) return false;
  const t = type.toUpperCase();
  return t === "OPENING" || t === "PURCHASE" || t === "ADJUSTMENT";
}

/**
 * Build a 12-month income statement for a calendar year.
 *
 * Formulas:
 * - Total Revenue = Sales Revenue + Service Income + Other Income
 * - Total COGS = Opening Inventory + Purchases + Direct Labour − Closing Inventory
 * - Gross Profit = Total Revenue − Total COGS
 * - Total Operating Expenses = sum of operating expense lines
 * - Net Profit = Gross Profit − Total Operating Expenses
 * - Cash on Hand (Beginning) = prior month Cash Position − prior month Reserves
 * - Total Revenue = Sales Revenue + Service Income + Other Income
 * - Total Cash Position (under revenue) = Total Revenue + Cash on Hand Beginning
 * - Reserve = money-mix % of that month's Total Revenue only; if monthly cash outflows
 *   exceed available cash (beginning + revenue), the shortfall reduces that month's reserve
 * - Below net profit: Loan, Capital, Reserve, Owner's Withdrawal, Total Cash Paid Out, Cash Position
 */
export async function fetchMonthlyIncomeStatement(
  companyId: string,
  year: number,
  businessName: string,
): Promise<MonthlyIncomeStatement> {
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const monthStarts = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1, 0, 0, 0, 0));

  const { fetchMonthEndCashBalances } = await import("@/lib/bank-ledger");

  const [
    companyProducts,
    stockMoves,
    saleLines,
    payments,
    purchases,
    timeEntries,
    expenses,
    payslips,
    company,
    cashBalances,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isService: false, trackStock: true },
      select: {
        id: true,
        stockQty: true,
        unitCost: true,
        variables: { orderBy: { sortOrder: "asc" }, select: { name: true, options: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: yearStart },
        product: { companyId, isService: false, trackStock: true },
      },
      select: {
        productId: true,
        quantity: true,
        createdAt: true,
        type: true,
        unitCost: true,
        notes: true,
      },
    }),
    prisma.saleLine.findMany({
      where: {
        sale: {
          companyId,
          status: "COMPLETED",
          soldAt: { gte: yearStart },
        },
      },
      select: {
        productId: true,
        lineTotal: true,
        quantity: true,
        variantLabel: true,
        product: {
          select: {
            isService: true,
            unitCost: true,
            variables: {
              orderBy: { sortOrder: "asc" },
              select: { name: true, options: true },
            },
          },
        },
        sale: { select: { soldAt: true, isRefund: true } },
      },
    }),
    prisma.payment.findMany({
      where: { companyId, paidAt: { gte: yearStart, lte: yearEnd } },
      select: {
        amount: true,
        paidAt: true,
        invoiceId: true,
        saleId: true,
        employeeId: true,
        supplierId: true,
        kind: true,
        reference: true,
        notes: true,
        customer: { select: { name: true } },
        employee: { select: { systemRole: true } },
      },
    }),
    prisma.supplierPurchase.findMany({
      where: { companyId, purchasedAt: { gte: yearStart, lte: yearEnd } },
      select: {
        totalCost: true,
        purchasedAt: true,
        supplierItem: { select: { supplyType: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        employee: { companyId },
        date: { gte: yearStart, lte: yearEnd },
        clockOutAt: { not: null },
      },
      select: {
        date: true,
        hours: true,
        hourlyRate: true,
        paymentAmount: true,
        employee: { select: { hourlyRate: true } },
      },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      select: { category: true, amount: true, date: true },
    }),
    prisma.employeePayslip.findMany({
      where: {
        companyId,
        periodEnd: { gte: yearStart, lte: yearEnd },
      },
      select: { grossPay: true, periodEnd: true },
    }),
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { moneyMixReservePct: true },
    }),
    fetchMonthEndCashBalances(companyId, year),
  ]);

  const reservePct = Number(company.moneyMixReservePct) || 0;
  const cashPosition = cashBalances.monthEnds;
  const yearStartCash = cashBalances.yearStartBalance;

  const valuedProducts: ValuedProduct[] = fillUnitCostFromMovements(
    companyProducts.map((p) => ({
      id: p.id,
      stockQty: p.stockQty,
      unitCost: p.unitCost,
      variables: p.variables.map((v) => ({
        name: v.name,
        options: parseVariableOptions(v.options),
      })),
    })),
    stockMoves,
  );
  const productById = new Map(valuedProducts.map((p) => [p.id, p]));

  const inventorySales = saleLines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    variantLabel: line.variantLabel,
    soldAt: line.sale.soldAt,
    isRefund: line.sale.isRefund,
    isService: Boolean(line.product?.isService),
  }));

  const salesRevenue = emptyMonths();
  const serviceIncome = emptyMonths();
  const otherIncome = emptyMonths();
  const purchasesMonths = emptyMonths();
  const directLabour = emptyMonths();
  const rentExpense = emptyMonths();
  const utilities = emptyMonths();
  const salariesWages = emptyMonths();
  const transportation = emptyMonths();
  const officeSupplies = emptyMonths();
  const marketingAdvertising = emptyMonths();
  const maintenance = emptyMonths();
  const insurance = emptyMonths();
  const miscellaneousExpenses = emptyMonths();
  const loanPrincipalPayment = emptyMonths();
  const capitalPurchase = emptyMonths();
  const reserveEscrow = emptyMonths();
  const ownersWithdrawal = emptyMonths();

  for (const line of saleLines) {
    if (line.sale.soldAt > yearEnd) continue;
    const service = Boolean(line.product?.isService);
    if (service) addToMonth(serviceIncome, line.sale.soldAt, line.lineTotal);
    else addToMonth(salesRevenue, line.sale.soldAt, line.lineTotal);
  }

  // Inventory received via Inventory/POS stock (not supplier invoices) still belongs in Purchases.
  for (const move of stockMoves) {
    if (!isInventoryPurchaseMovement(move.type, move.quantity)) continue;
    const product = productById.get(move.productId);
    const unitCost =
      move.unitCost > 0
        ? move.unitCost
        : product
          ? effectiveProductUnitCost(product, product.variables)
          : 0;
    if (unitCost <= 0) continue;
    addToMonth(purchasesMonths, move.createdAt, Math.round(move.quantity * unitCost));
  }

  for (const pay of payments) {
    if (isOwnerDrawingPayment(pay)) {
      addToMonth(ownersWithdrawal, pay.paidAt, pay.amount);
      continue;
    }
    if (pay.employeeId || isSalaryPayment(pay)) {
      addToMonth(salariesWages, pay.paidAt, pay.amount);
      continue;
    }
    if (pay.supplierId) {
      continue;
    }
    const ref = `${pay.reference || ""} ${pay.notes || ""}`.toLowerCase();
    const isPos = ref.includes("pos") || Boolean(pay.reference?.startsWith("POS"));
    if (isPos) continue;
    if (pay.invoiceId) {
      addToMonth(serviceIncome, pay.paidAt, pay.amount);
    } else if (!isSalaryPayment(pay)) {
      addToMonth(otherIncome, pay.paidAt, pay.amount);
    }
  }

  for (const purchase of purchases) {
    const supplyType = purchase.supplierItem?.supplyType || "MATERIAL";
    if (supplyType === "EQUIPMENT") {
      addToMonth(capitalPurchase, purchase.purchasedAt, purchase.totalCost);
      continue;
    }
    if (supplyType === "EQUIPMENT_RENTAL") {
      addToMonth(maintenance, purchase.purchasedAt, purchase.totalCost);
      continue;
    }
    addToMonth(purchasesMonths, purchase.purchasedAt, purchase.totalCost);
  }

  for (const entry of timeEntries) {
    const rate = entry.hourlyRate > 0 ? entry.hourlyRate : entry.employee.hourlyRate;
    const pay =
      rate > 0 ? Math.round(entry.hours * rate) : Math.max(0, entry.paymentAmount ?? 0);
    addToMonth(directLabour, entry.date, pay);
  }

  for (const slip of payslips) {
    addToMonth(salariesWages, slip.periodEnd, slip.grossPay);
  }

  for (const expense of expenses) {
    const amount = expense.amount;
    const cat = expense.category || "";
    if (matchCategory(cat, [/loan\s*principal|principal\s*payment|loan\s*payment/i])) {
      addToMonth(loanPrincipalPayment, expense.date, amount);
    } else if (
      matchCategory(cat, [
        /capital\s*purchase|capital\s*expend|capex/i,
        /^equipment$/i,
        /^equipment\s+purchase/i,
      ])
    ) {
      // Quote→invoice equipment and explicit capital expenses (not rentals).
      addToMonth(capitalPurchase, expense.date, amount);
    } else if (matchCategory(cat, [/reserve|escrow/i])) {
      // Reserve/escrow expense cash-outs stay in miscellaneous; the Reserve line is
      // computed from bank money-mix % × cash position (compounded monthly).
      addToMonth(miscellaneousExpenses, expense.date, amount);
    } else if (matchCategory(cat, [/owner.?s?\s*withdraw|owner.?s?\s*draw|drawings?/i])) {
      addToMonth(ownersWithdrawal, expense.date, amount);
    } else if (matchCategory(cat, [/^rent\b/i, /lease/i])) {
      addToMonth(rentExpense, expense.date, amount);
    } else if (matchCategory(cat, [/utilit/i, /electric/i, /water/i, /internet/i])) {
      addToMonth(utilities, expense.date, amount);
    } else if (matchCategory(cat, [/salary|salaries|wage|payroll|staff/i])) {
      addToMonth(salariesWages, expense.date, amount);
    } else if (matchCategory(cat, [/transport|fuel|delivery|shipping/i])) {
      addToMonth(transportation, expense.date, amount);
    } else if (matchCategory(cat, [/office|supplies|stationery/i])) {
      addToMonth(officeSupplies, expense.date, amount);
    } else if (matchCategory(cat, [/market|advert|promo|promotion/i])) {
      addToMonth(marketingAdvertising, expense.date, amount);
    } else if (matchCategory(cat, [/mainten|repair|equipment\s*rental/i])) {
      addToMonth(maintenance, expense.date, amount);
    } else if (matchCategory(cat, [/insur/i])) {
      addToMonth(insurance, expense.date, amount);
    } else if (matchCategory(cat, [/^materials?$/i])) {
      addToMonth(purchasesMonths, expense.date, amount);
    } else {
      addToMonth(miscellaneousExpenses, expense.date, amount);
    }
  }

  const openingInventory = emptyMonths();
  const closingInventory = emptyMonths();
  for (let m = 0; m < 12; m++) {
    const nextMonthStart = new Date(year, m + 1, 1, 0, 0, 0, 0);
    openingInventory[m] = inventoryValueAsOfCents(
      valuedProducts,
      monthStarts[m]!,
      inventorySales,
      stockMoves,
    );
    closingInventory[m] = inventoryValueAsOfCents(
      valuedProducts,
      nextMonthStart,
      inventorySales,
      stockMoves,
    );
  }

  // Sales-based COGS (qty × unit cost) — used when the inventory identity understates cost
  // (e.g. missing unit costs on movements / opening stock entered without cost).
  const salesCogs = emptyMonths();
  for (const line of saleLines) {
    if (!line.product || line.product.isService) continue;
    const variables = line.product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options),
    }));
    const unitCost = resolveSaleUnitCost(line.product, variables, line.variantLabel);
    if (unitCost <= 0) continue;
    if (line.sale.soldAt > yearEnd) continue;
    const sign = line.lineTotal < 0 || line.sale.isRefund ? -1 : 1;
    addToMonth(salesCogs, line.sale.soldAt, Math.round(unitCost * line.quantity) * sign);
  }

  const totalRevenue = emptyMonths();
  const totalCogs = emptyMonths();
  const grossProfit = emptyMonths();
  const totalOperatingExpenses = emptyMonths();
  const netProfit = emptyMonths();
  const cashOnHandBeginning = emptyMonths();
  const totalCashPositionUnderRevenue = emptyMonths();
  const reserveEscrowCalc = emptyMonths();
  const totalCashPaidOut = emptyMonths();

  for (let m = 0; m < 12; m++) {
    totalRevenue[m] =
      salesRevenue[m]! + serviceIncome[m]! + otherIncome[m]!;
    // Total COGS = Opening + Purchases + Direct Labour − Closing
    const inventoryCogs =
      openingInventory[m]! +
      purchasesMonths[m]! +
      directLabour[m]! -
      closingInventory[m]!;
    // If inventory identity is zero/negative but goods were sold with a known cost,
    // use sold-goods cost so Gross Profit is not overstated.
    totalCogs[m] =
      inventoryCogs > 0
        ? inventoryCogs
        : salesCogs[m]! > 0
          ? salesCogs[m]! + directLabour[m]!
          : inventoryCogs;
    grossProfit[m] = totalRevenue[m]! - totalCogs[m]!;
    totalOperatingExpenses[m] =
      rentExpense[m]! +
      utilities[m]! +
      salariesWages[m]! +
      transportation[m]! +
      officeSupplies[m]! +
      marketingAdvertising[m]! +
      maintenance[m]! +
      insurance[m]! +
      miscellaneousExpenses[m]!;
    netProfit[m] = grossProfit[m]! - totalOperatingExpenses[m]!;

    // Beginning cash = prior month-end cash position minus prior reserves (unreserved cash).
    cashOnHandBeginning[m] =
      m === 0
        ? yearStartCash
        : (cashPosition[m - 1] ?? 0) - (reserveEscrowCalc[m - 1] ?? 0);

    totalCashPositionUnderRevenue[m] = totalRevenue[m]! + cashOnHandBeginning[m]!;

    // Reserves = % of this month's total revenue only (not beginning cash).
    const plannedReserve = Math.round(totalRevenue[m]! * (reservePct / 100));
    const cashOutBeforeReserve =
      totalOperatingExpenses[m]! +
      loanPrincipalPayment[m]! +
      capitalPurchase[m]! +
      ownersWithdrawal[m]!;
    const availableCash = cashOnHandBeginning[m]! + totalRevenue[m]!;
    const shortfall = Math.max(0, cashOutBeforeReserve - availableCash);
    // If outflows exceed available cash, dip into this month's planned reserves first.
    reserveEscrowCalc[m] = Math.max(0, plannedReserve - shortfall);

    totalCashPaidOut[m] =
      totalOperatingExpenses[m]! +
      loanPrincipalPayment[m]! +
      capitalPurchase[m]! +
      reserveEscrowCalc[m]! +
      ownersWithdrawal[m]!;
  }

  // Expose calculated reserves on the existing reserveEscrow series
  for (let m = 0; m < 12; m++) {
    reserveEscrow[m] = reserveEscrowCalc[m]!;
  }

  const yy = String(year).slice(-2);
  const monthLabels = INCOME_STATEMENT_MONTHS.map((label) => `${label}-${yy}`);

  const line = (
    id: IncomeStatementLineId,
    label: string,
    months: number[],
    kind: IncomeStatementRowKind = "line",
    formula?: string,
  ): IncomeStatementRow => ({
    id,
    label,
    kind,
    months,
    total: sumMonths(months),
    formula,
  });

  const section = (id: string, label: string): IncomeStatementRow => ({
    id,
    label,
    kind: "section",
    months: null,
    total: null,
  });

  const rows: IncomeStatementRow[] = [
    section("sec-revenue", "Revenue (Income)"),
    line(
      "cashOnHandBeginning",
      "Cash on Hand (Beginning of Month)",
      cashOnHandBeginning,
      "line",
      "Prior month Cash Position − prior month Reserves (January uses year-start bank balance)",
    ),
    line("salesRevenue", "Sales Revenue", salesRevenue),
    line("serviceIncome", "Service Income", serviceIncome),
    line("otherIncome", "Other Income", otherIncome),
    line(
      "totalRevenue",
      "Total Revenue",
      totalRevenue,
      "total",
      "Sales Revenue + Service Income + Other Income",
    ),
    line(
      "totalCashPosition",
      "Total Cash Position",
      totalCashPositionUnderRevenue,
      "result",
      "Total Revenue + Cash on Hand (Beginning of Month)",
    ),
    section("sec-cogs", "Cost of Goods Sold (COGS)"),
    line(
      "openingInventory",
      "Opening Inventory",
      openingInventory,
      "line",
      "On-hand qty × unit cost at month start for variants and items without variants (current stock plus goods sold since then)",
    ),
    line("purchases", "Purchases", purchasesMonths),
    line("directLabour", "Direct Labour", directLabour),
    line(
      "closingInventory",
      "Closing Inventory",
      closingInventory,
      "line",
      "On-hand qty × unit cost at month end for variants and items without variants",
    ),
    line(
      "totalCogs",
      "Total COGS",
      totalCogs,
      "total",
      "Opening Inventory + Purchases + Direct Labour − Closing Inventory",
    ),
    line(
      "grossProfit",
      "Gross Profit",
      grossProfit,
      "result",
      "Total Revenue − Total COGS",
    ),
    section("sec-opex", "Operating Expenses"),
    line("rentExpense", "Rent Expense", rentExpense),
    line("utilities", "Utilities", utilities),
    line("salariesWages", "Salaries/Wages", salariesWages),
    line("transportation", "Transportation", transportation),
    line("officeSupplies", "Office Supplies", officeSupplies),
    line("marketingAdvertising", "Marketing/Advertising", marketingAdvertising),
    line("maintenance", "Maintenance", maintenance),
    line("insurance", "Insurance", insurance),
    line(
      "miscellaneousExpenses",
      "Miscellaneous Expenses (Subscription)",
      miscellaneousExpenses,
    ),
    line(
      "totalOperatingExpenses",
      "Total Operating Expenses",
      totalOperatingExpenses,
      "total",
      "Sum of operating expense lines",
    ),
    line(
      "netProfit",
      "Net Profit (or Loss)",
      netProfit,
      "result",
      "Gross Profit − Total Operating Expenses",
    ),
    section("sec-below-net", "Below net profit"),
    line("loanPrincipalPayment", "Loan Principal Payment", loanPrincipalPayment),
    line("capitalPurchase", "Capital Purchase", capitalPurchase),
    line(
      "reserveEscrow",
      "Reserve and/or Escrow",
      reserveEscrow,
      "line",
      `${reservePct}% of Total Revenue for the month; reduced if outflows exceed Cash on Hand Beginning + Total Revenue`,
    ),
    line(
      "ownersWithdrawal",
      "Owner's Withdrawal",
      ownersWithdrawal,
      "line",
      "Owner drawings and owner withdrawal expenses",
    ),
    line(
      "totalCashPaidOut",
      "Total Cash Paid Out",
      totalCashPaidOut,
      "total",
      "Total Operating Expenses + Loan Principal + Capital Purchase + Reserve + Owner's Withdrawal",
    ),
    line(
      "cashPosition",
      "Cash Position",
      cashPosition,
      "result",
      "Remaining funds in the bank at month end",
    ),
  ];

  return {
    businessName,
    year,
    monthLabels,
    rows,
  };
}

export type SingleMonthIncomeStatement = {
  businessName: string;
  year: number;
  month: number;
  monthLabel: string;
  rows: {
    id: string;
    label: string;
    kind: IncomeStatementRowKind;
    amount: number;
    formula?: string;
  }[];
};

export function extractSingleMonth(
  statement: MonthlyIncomeStatement,
  monthIndex: number,
): SingleMonthIncomeStatement {
  const monthLabel = statement.monthLabels[monthIndex] ?? `Month ${monthIndex + 1}`;
  const rows = statement.rows
    .filter((row) => row.kind !== "section")
    .map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      amount: row.months?.[monthIndex] ?? 0,
      formula: row.formula,
    }));

  return {
    businessName: statement.businessName,
    year: statement.year,
    month: monthIndex + 1,
    monthLabel,
    rows,
  };
}
