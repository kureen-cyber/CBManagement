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
import {
  appYearMonth,
  endOfAppYear,
  startOfAppCalendarMonth,
} from "@/lib/timezone";

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
  | "subscription"
  | "bankCharges"
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

export type IncomeStatementSetup = {
  setAt: Date;
  startAt: Date;
  cashOnHandCents: number;
  reserveCents: number;
  openingInventoryCents: number;
};

export type MonthlyIncomeStatement = {
  businessName: string;
  year: number;
  monthLabels: string[];
  rows: IncomeStatementRow[];
  configured: boolean;
  startedAt: Date | null;
  setAt: Date | null;
};

function emptyMonths() {
  return Array.from({ length: 12 }, () => 0);
}

function sumMonths(months: number[]) {
  return months.reduce((s, v) => s + v, 0);
}

function matchCategory(category: string, patterns: RegExp[]) {
  const c = category.trim().toLowerCase();
  return patterns.some((p) => p.test(c));
}

/** Stock quantity increases after the statement is set count as Purchases. */
function isPostSetupStockPurchase(type: string, quantity: number) {
  if (quantity <= 0) return false;
  const t = type.toUpperCase();
  return t === "PURCHASE" || t === "ADJUSTMENT" || t === "OPENING";
}

/** Matches inventory-valuation inbound moves that are undone when reconstructing as-of stock. */
function isReversibleInboundMove(type: string, quantity: number) {
  if (quantity <= 0) return false;
  const t = type.toUpperCase();
  return t === "PURCHASE" || t === "ADJUSTMENT";
}

function moveUnitCostCents(
  move: { productId: string; unitCost: number; quantity: number },
  productById: Map<string, ValuedProduct>,
) {
  if (move.unitCost > 0) return move.unitCost;
  const product = productById.get(move.productId);
  return product ? effectiveProductUnitCost(product, product.variables) : 0;
}

function inboundMoveValueCents(
  move: { productId: string; unitCost: number; quantity: number; type: string },
  productById: Map<string, ValuedProduct>,
  predicate: (type: string, quantity: number) => boolean,
) {
  if (!predicate(move.type, move.quantity)) return 0;
  const unitCost = moveUnitCostCents(move, productById);
  if (unitCost <= 0) return 0;
  return Math.round(move.quantity * unitCost);
}

export function incomeStatementSetupFromCompany(company: {
  incomeStatementSetAt?: Date | null;
  incomeStatementStartAt?: Date | null;
  incomeStatementCashOnHandCents?: number | null;
  incomeStatementReserveCents?: number | null;
  incomeStatementOpeningInventoryCents?: number | null;
}): IncomeStatementSetup | null {
  if (!company.incomeStatementSetAt || !company.incomeStatementStartAt) return null;
  return {
    setAt: company.incomeStatementSetAt,
    startAt: company.incomeStatementStartAt,
    cashOnHandCents: Math.max(0, company.incomeStatementCashOnHandCents ?? 0),
    reserveCents: Math.max(0, company.incomeStatementReserveCents ?? 0),
    openingInventoryCents: Math.max(0, company.incomeStatementOpeningInventoryCents ?? 0),
  };
}

type ProductRow = {
  id: string;
  stockQty: number;
  unitCost: number;
  variables: { name: string; options: string }[];
};

function toValuedProducts(
  products: ProductRow[],
  costMoves: { productId: string; unitCost: number; createdAt: Date }[],
): ValuedProduct[] {
  return fillUnitCostFromMovements(
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
}

async function loadTrackedInventory(companyId: string) {
  const [companyProducts, stockMoves, saleLines] = await Promise.all([
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
      where: { product: { companyId, isService: false, trackStock: true } },
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
        sale: { companyId, status: "COMPLETED" },
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
  ]);

  const valuedProducts = toValuedProducts(companyProducts, stockMoves);
  const productById = new Map(valuedProducts.map((p) => [p.id, p]));
  const inventorySales = saleLines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    variantLabel: line.variantLabel,
    soldAt: line.sale.soldAt,
    isRefund: line.sale.isRefund,
    isService: Boolean(line.product?.isService),
  }));

  return { valuedProducts, productById, stockMoves, saleLines, inventorySales };
}

/**
 * Opening inventory at setup: on-hand at the 1st of the setup month, plus stock
 * logged from that 1st through the moment the owner sets the statement.
 */
export async function snapshotOpeningInventoryCents(
  companyId: string,
  startAt: Date,
  setAt: Date,
): Promise<number> {
  const { valuedProducts, productById, stockMoves, inventorySales } =
    await loadTrackedInventory(companyId);
  const asOfMonthStart = inventoryValueAsOfCents(
    valuedProducts,
    startAt,
    inventorySales,
    stockMoves,
  );
  let inboundFromFirst = 0;
  for (const move of stockMoves) {
    if (move.createdAt < startAt || move.createdAt > setAt) continue;
    inboundFromFirst += inboundMoveValueCents(move, productById, isReversibleInboundMove);
  }
  return Math.max(0, asOfMonthStart + inboundFromFirst);
}

function emptyStatement(
  businessName: string,
  year: number,
  extra?: Partial<MonthlyIncomeStatement>,
): MonthlyIncomeStatement {
  const yy = String(year).slice(-2);
  return {
    businessName,
    year,
    monthLabels: INCOME_STATEMENT_MONTHS.map((label) => `${label}-${yy}`),
    rows: [],
    configured: false,
    startedAt: null,
    setAt: null,
    ...extra,
  };
}

/**
 * Build a 12-month income statement for a calendar year.
 *
 * The statement does not auto-create from historical app data. After the owner
 * sets cash on hand, reserve/escrow, and opening inventory:
 * - Calculations begin on the 1st of that month (Trinidad time)
 * - Existing inventory (including stock logged from that 1st) is opening inventory
 * - Purchases after setup are stock quantity increases plus in-period supplier buys
 */
export async function fetchMonthlyIncomeStatement(
  companyId: string,
  year: number,
  businessName: string,
): Promise<MonthlyIncomeStatement> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      moneyMixReservePct: true,
      incomeStatementSetAt: true,
      incomeStatementStartAt: true,
      incomeStatementCashOnHandCents: true,
      incomeStatementReserveCents: true,
      incomeStatementOpeningInventoryCents: true,
    },
  });

  const setup = incomeStatementSetupFromCompany(company);
  const yy = String(year).slice(-2);
  const monthLabels = INCOME_STATEMENT_MONTHS.map((label) => `${label}-${yy}`);

  if (!setup) {
    return emptyStatement(businessName, year);
  }

  const startParts = appYearMonth(setup.startAt);
  if (!startParts) {
    return emptyStatement(businessName, year, {
      configured: true,
      startedAt: setup.startAt,
      setAt: setup.setAt,
    });
  }

  const { year: startYear, monthIndex: startMonthIdx } = startParts;
  if (year < startYear) {
    return {
      ...emptyStatement(businessName, year, {
        configured: true,
        startedAt: setup.startAt,
        setAt: setup.setAt,
      }),
      rows: buildRows({
        cashOnHandBeginning: emptyMonths(),
        salesRevenue: emptyMonths(),
        serviceIncome: emptyMonths(),
        otherIncome: emptyMonths(),
        totalRevenue: emptyMonths(),
        totalCashPositionUnderRevenue: emptyMonths(),
        openingInventory: emptyMonths(),
        purchasesMonths: emptyMonths(),
        directLabour: emptyMonths(),
        closingInventory: emptyMonths(),
        totalCogs: emptyMonths(),
        grossProfit: emptyMonths(),
        rentExpense: emptyMonths(),
        utilities: emptyMonths(),
        salariesWages: emptyMonths(),
        transportation: emptyMonths(),
        officeSupplies: emptyMonths(),
        marketingAdvertising: emptyMonths(),
        maintenance: emptyMonths(),
        insurance: emptyMonths(),
        subscription: emptyMonths(),
        bankCharges: emptyMonths(),
        miscellaneousExpenses: emptyMonths(),
        totalOperatingExpenses: emptyMonths(),
        netProfit: emptyMonths(),
        loanPrincipalPayment: emptyMonths(),
        capitalPurchase: emptyMonths(),
        reserveEscrow: emptyMonths(),
        ownersWithdrawal: emptyMonths(),
        totalCashPaidOut: emptyMonths(),
        cashPosition: emptyMonths(),
        reservePct: Number(company.moneyMixReservePct) || 0,
      }),
    };
  }

  const yearEnd = endOfAppYear(year);
  const monthCount = (year - startYear) * 12 + (11 - startMonthIdx) + 1;
  const reservePct = Number(company.moneyMixReservePct) || 0;

  const [
    inventory,
    payments,
    purchases,
    timeEntries,
    expenses,
    payslips,
  ] = await Promise.all([
    loadTrackedInventory(companyId),
    prisma.payment.findMany({
      where: { companyId, paidAt: { gte: setup.startAt, lte: yearEnd } },
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
      where: { companyId, purchasedAt: { gte: setup.startAt, lte: yearEnd } },
      select: {
        totalCost: true,
        purchasedAt: true,
        supplierItem: { select: { supplyType: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        employee: { companyId },
        date: { gte: setup.startAt, lte: yearEnd },
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
      where: { companyId, date: { gte: setup.startAt, lte: yearEnd } },
      select: { category: true, amount: true, date: true },
    }),
    prisma.employeePayslip.findMany({
      where: {
        companyId,
        periodEnd: { gte: setup.startAt, lte: yearEnd },
      },
      select: { grossPay: true, periodEnd: true },
    }),
  ]);

  const { valuedProducts, productById, stockMoves, saleLines, inventorySales } = inventory;

  const zeros = () => Array.from({ length: monthCount }, () => 0);
  const salesRevenue = zeros();
  const serviceIncome = zeros();
  const otherIncome = zeros();
  const purchasesMonths = zeros();
  const directLabour = zeros();
  const rentExpense = zeros();
  const utilities = zeros();
  const salariesWages = zeros();
  const transportation = zeros();
  const officeSupplies = zeros();
  const marketingAdvertising = zeros();
  const maintenance = zeros();
  const insurance = zeros();
  const subscription = zeros();
  const bankCharges = zeros();
  const miscellaneousExpenses = zeros();
  const loanPrincipalPayment = zeros();
  const capitalPurchase = zeros();
  const ownersWithdrawal = zeros();
  const salesCogs = zeros();

  const slotOf = (d: Date): number | null => {
    if (d < setup.startAt) return null;
    const parts = appYearMonth(d);
    if (!parts) return null;
    const idx = (parts.year - startYear) * 12 + parts.monthIndex - startMonthIdx;
    if (idx < 0 || idx >= monthCount) return null;
    return idx;
  };

  const addToSlot = (target: number[], d: Date, amount: number) => {
    const i = slotOf(d);
    if (i == null) return;
    target[i]! += amount;
  };

  for (const line of saleLines) {
    const soldAt = line.sale.soldAt;
    if (soldAt < setup.startAt || soldAt > yearEnd) continue;
    const service = Boolean(line.product?.isService);
    if (service) addToSlot(serviceIncome, soldAt, line.lineTotal);
    else addToSlot(salesRevenue, soldAt, line.lineTotal);
  }

  for (const move of stockMoves) {
    if (move.createdAt <= setup.setAt) continue;
    if (move.createdAt > yearEnd) continue;
    const value = inboundMoveValueCents(move, productById, isPostSetupStockPurchase);
    if (value <= 0) continue;
    addToSlot(purchasesMonths, move.createdAt, value);
  }

  for (const pay of payments) {
    if (isOwnerDrawingPayment(pay)) {
      addToSlot(ownersWithdrawal, pay.paidAt, pay.amount);
      continue;
    }
    if (pay.employeeId || isSalaryPayment(pay)) {
      addToSlot(salariesWages, pay.paidAt, pay.amount);
      continue;
    }
    if (pay.supplierId) {
      continue;
    }
    const ref = `${pay.reference || ""} ${pay.notes || ""}`.toLowerCase();
    const isPos = ref.includes("pos") || Boolean(pay.reference?.startsWith("POS"));
    if (isPos) continue;
    if (pay.invoiceId) {
      addToSlot(serviceIncome, pay.paidAt, pay.amount);
    } else if (!isSalaryPayment(pay)) {
      addToSlot(otherIncome, pay.paidAt, pay.amount);
    }
  }

  for (const purchase of purchases) {
    if (purchase.purchasedAt <= setup.setAt) continue;
    const supplyType = purchase.supplierItem?.supplyType || "MATERIAL";
    if (supplyType === "EQUIPMENT") {
      addToSlot(capitalPurchase, purchase.purchasedAt, purchase.totalCost);
      continue;
    }
    if (supplyType === "EQUIPMENT_RENTAL") {
      addToSlot(maintenance, purchase.purchasedAt, purchase.totalCost);
      continue;
    }
    addToSlot(purchasesMonths, purchase.purchasedAt, purchase.totalCost);
  }

  for (const entry of timeEntries) {
    const rate = entry.hourlyRate > 0 ? entry.hourlyRate : entry.employee.hourlyRate;
    const pay =
      rate > 0 ? Math.round(entry.hours * rate) : Math.max(0, entry.paymentAmount ?? 0);
    addToSlot(directLabour, entry.date, pay);
  }

  for (const slip of payslips) {
    addToSlot(salariesWages, slip.periodEnd, slip.grossPay);
  }

  for (const expense of expenses) {
    const amount = expense.amount;
    const cat = expense.category || "";
    if (expense.date <= setup.setAt && matchCategory(cat, [/^materials?$/i, /^stock$/i])) {
      continue;
    }
    if (matchCategory(cat, [/loan\s*principal|principal\s*payment|loan\s*payment/i])) {
      addToSlot(loanPrincipalPayment, expense.date, amount);
    } else if (
      matchCategory(cat, [
        /capital\s*purchase|capital\s*expend|capex/i,
        /^equipment$/i,
        /^equipment\s+purchase/i,
      ])
    ) {
      addToSlot(capitalPurchase, expense.date, amount);
    } else if (matchCategory(cat, [/reserve|escrow/i])) {
      addToSlot(miscellaneousExpenses, expense.date, amount);
    } else if (matchCategory(cat, [/owner.?s?\s*withdraw|owner.?s?\s*draw|drawings?/i])) {
      addToSlot(ownersWithdrawal, expense.date, amount);
    } else if (matchCategory(cat, [/^rent\b/i, /lease/i])) {
      addToSlot(rentExpense, expense.date, amount);
    } else if (matchCategory(cat, [/utilit/i, /electric/i, /water/i, /internet/i])) {
      addToSlot(utilities, expense.date, amount);
    } else if (matchCategory(cat, [/salary|salaries|wage|payroll|staff/i])) {
      addToSlot(salariesWages, expense.date, amount);
    } else if (matchCategory(cat, [/transport|fuel|delivery|shipping/i])) {
      addToSlot(transportation, expense.date, amount);
    } else if (matchCategory(cat, [/office|supplies|stationery/i])) {
      addToSlot(officeSupplies, expense.date, amount);
    } else if (matchCategory(cat, [/market|advert|promo|promotion/i])) {
      addToSlot(marketingAdvertising, expense.date, amount);
    } else if (matchCategory(cat, [/mainten|repair|equipment\s*rental/i])) {
      addToSlot(maintenance, expense.date, amount);
    } else if (matchCategory(cat, [/insur/i])) {
      addToSlot(insurance, expense.date, amount);
    } else if (matchCategory(cat, [/subscri/i])) {
      addToSlot(subscription, expense.date, amount);
    } else if (matchCategory(cat, [/bank\s*(charges?|fees?)/i])) {
      addToSlot(bankCharges, expense.date, amount);
    } else if (matchCategory(cat, [/^materials?$/i, /^stock$/i])) {
      if (expense.date > setup.setAt) addToSlot(purchasesMonths, expense.date, amount);
    } else {
      addToSlot(miscellaneousExpenses, expense.date, amount);
    }
  }

  const openingInventory = zeros();
  const closingInventory = zeros();
  for (let i = 0; i < monthCount; i++) {
    const calendarOffset = startMonthIdx + i;
    const slotYear = startYear + Math.floor(calendarOffset / 12);
    const slotMonth = calendarOffset % 12;
    const monthStart = startOfAppCalendarMonth(slotYear, slotMonth);
    const nextMonthStart = startOfAppCalendarMonth(slotYear, slotMonth + 1);
    openingInventory[i] =
      i === 0
        ? setup.openingInventoryCents
        : inventoryValueAsOfCents(valuedProducts, monthStart, inventorySales, stockMoves);
    closingInventory[i] = inventoryValueAsOfCents(
      valuedProducts,
      nextMonthStart,
      inventorySales,
      stockMoves,
    );
  }

  for (const line of saleLines) {
    if (!line.product || line.product.isService) continue;
    const soldAt = line.sale.soldAt;
    if (soldAt < setup.startAt || soldAt > yearEnd) continue;
    const variables = line.product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options),
    }));
    const unitCost = resolveSaleUnitCost(line.product, variables, line.variantLabel);
    if (unitCost <= 0) continue;
    const sign = line.lineTotal < 0 || line.sale.isRefund ? -1 : 1;
    addToSlot(salesCogs, soldAt, Math.round(unitCost * line.quantity) * sign);
  }

  const totalRevenue = zeros();
  const totalCogs = zeros();
  const grossProfit = zeros();
  const totalOperatingExpenses = zeros();
  const netProfit = zeros();
  const cashOnHandBeginning = zeros();
  const totalCashPositionUnderRevenue = zeros();
  const reserveEscrow = zeros();
  const totalCashPaidOut = zeros();
  const cashPosition = zeros();

  for (let i = 0; i < monthCount; i++) {
    totalRevenue[i] = salesRevenue[i]! + serviceIncome[i]! + otherIncome[i]!;
    const inventoryCogs =
      openingInventory[i]! + purchasesMonths[i]! + directLabour[i]! - closingInventory[i]!;
    totalCogs[i] =
      inventoryCogs > 0
        ? inventoryCogs
        : salesCogs[i]! > 0
          ? salesCogs[i]! + directLabour[i]!
          : inventoryCogs;
    grossProfit[i] = totalRevenue[i]! - totalCogs[i]!;
    totalOperatingExpenses[i] =
      rentExpense[i]! +
      utilities[i]! +
      salariesWages[i]! +
      transportation[i]! +
      officeSupplies[i]! +
      marketingAdvertising[i]! +
      maintenance[i]! +
      insurance[i]! +
      subscription[i]! +
      bankCharges[i]! +
      miscellaneousExpenses[i]!;
    netProfit[i] = grossProfit[i]! - totalOperatingExpenses[i]!;

    cashOnHandBeginning[i] =
      i === 0 ? setup.cashOnHandCents : cashPosition[i - 1]!;

    totalCashPositionUnderRevenue[i] = totalRevenue[i]! + cashOnHandBeginning[i]!;

    const cashOutBeforeReserve =
      totalOperatingExpenses[i]! +
      loanPrincipalPayment[i]! +
      capitalPurchase[i]! +
      ownersWithdrawal[i]!;

    if (i === 0) {
      // Owner-entered escrow is already held — show it, but do not treat it as a new outflow.
      reserveEscrow[i] = setup.reserveCents;
      totalCashPaidOut[i] = cashOutBeforeReserve;
    } else {
      const plannedReserve = Math.round(totalRevenue[i]! * (reservePct / 100));
      const availableCash = cashOnHandBeginning[i]! + totalRevenue[i]!;
      const shortfall = Math.max(0, cashOutBeforeReserve - availableCash);
      reserveEscrow[i] = Math.max(0, plannedReserve - shortfall);
      totalCashPaidOut[i] = cashOutBeforeReserve + reserveEscrow[i]!;
    }

    cashPosition[i] =
      cashOnHandBeginning[i]! + totalRevenue[i]! - totalCashPaidOut[i]!;
  }

  const toYearMonths = (series: number[]) => {
    const out = emptyMonths();
    for (let i = 0; i < monthCount; i++) {
      const calendarOffset = startMonthIdx + i;
      const slotYear = startYear + Math.floor(calendarOffset / 12);
      if (slotYear !== year) continue;
      out[calendarOffset % 12] = series[i]!;
    }
    return out;
  };

  return {
    businessName,
    year,
    monthLabels,
    configured: true,
    startedAt: setup.startAt,
    setAt: setup.setAt,
    rows: buildRows({
      cashOnHandBeginning: toYearMonths(cashOnHandBeginning),
      salesRevenue: toYearMonths(salesRevenue),
      serviceIncome: toYearMonths(serviceIncome),
      otherIncome: toYearMonths(otherIncome),
      totalRevenue: toYearMonths(totalRevenue),
      totalCashPositionUnderRevenue: toYearMonths(totalCashPositionUnderRevenue),
      openingInventory: toYearMonths(openingInventory),
      purchasesMonths: toYearMonths(purchasesMonths),
      directLabour: toYearMonths(directLabour),
      closingInventory: toYearMonths(closingInventory),
      totalCogs: toYearMonths(totalCogs),
      grossProfit: toYearMonths(grossProfit),
      rentExpense: toYearMonths(rentExpense),
      utilities: toYearMonths(utilities),
      salariesWages: toYearMonths(salariesWages),
      transportation: toYearMonths(transportation),
      officeSupplies: toYearMonths(officeSupplies),
      marketingAdvertising: toYearMonths(marketingAdvertising),
      maintenance: toYearMonths(maintenance),
      insurance: toYearMonths(insurance),
      subscription: toYearMonths(subscription),
      bankCharges: toYearMonths(bankCharges),
      miscellaneousExpenses: toYearMonths(miscellaneousExpenses),
      totalOperatingExpenses: toYearMonths(totalOperatingExpenses),
      netProfit: toYearMonths(netProfit),
      loanPrincipalPayment: toYearMonths(loanPrincipalPayment),
      capitalPurchase: toYearMonths(capitalPurchase),
      reserveEscrow: toYearMonths(reserveEscrow),
      ownersWithdrawal: toYearMonths(ownersWithdrawal),
      totalCashPaidOut: toYearMonths(totalCashPaidOut),
      cashPosition: toYearMonths(cashPosition),
      reservePct,
    }),
  };
}

function buildRows(input: {
  cashOnHandBeginning: number[];
  salesRevenue: number[];
  serviceIncome: number[];
  otherIncome: number[];
  totalRevenue: number[];
  totalCashPositionUnderRevenue: number[];
  openingInventory: number[];
  purchasesMonths: number[];
  directLabour: number[];
  closingInventory: number[];
  totalCogs: number[];
  grossProfit: number[];
  rentExpense: number[];
  utilities: number[];
  salariesWages: number[];
  transportation: number[];
  officeSupplies: number[];
  marketingAdvertising: number[];
  maintenance: number[];
  insurance: number[];
  subscription: number[];
  bankCharges: number[];
  miscellaneousExpenses: number[];
  totalOperatingExpenses: number[];
  netProfit: number[];
  loanPrincipalPayment: number[];
  capitalPurchase: number[];
  reserveEscrow: number[];
  ownersWithdrawal: number[];
  totalCashPaidOut: number[];
  cashPosition: number[];
  reservePct: number;
}): IncomeStatementRow[] {
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

  return [
    section("sec-revenue", "Revenue"),
    line(
      "cashOnHandBeginning",
      "Cash on Hand",
      input.cashOnHandBeginning,
      "line",
      "Owner-entered cash in the first month; then prior Cash Position",
    ),
    line("salesRevenue", "Sales Revenue", input.salesRevenue),
    line("serviceIncome", "Service Income", input.serviceIncome),
    line("otherIncome", "Other Income", input.otherIncome),
    line(
      "totalRevenue",
      "Total Revenue",
      input.totalRevenue,
      "total",
      "Sales + Service + Other",
    ),
    line(
      "totalCashPosition",
      "Total Cash Position",
      input.totalCashPositionUnderRevenue,
      "result",
      "Total Revenue + Cash on Hand",
    ),
    section("sec-cogs", "COGS"),
    line(
      "openingInventory",
      "Opening Inventory",
      input.openingInventory,
      "line",
      "All stock on hand when the statement was set, including inventory logged from the 1st of that month",
    ),
    line(
      "purchases",
      "Purchases",
      input.purchasesMonths,
      "line",
      "Stock quantity increases and supplier purchases after the statement was set",
    ),
    line("directLabour", "Direct Labour", input.directLabour),
    line("closingInventory", "Closing Inventory", input.closingInventory),
    line(
      "totalCogs",
      "Total COGS",
      input.totalCogs,
      "total",
      "Opening + Purchases + Direct Labour − Closing",
    ),
    line("grossProfit", "Gross Profit", input.grossProfit, "result", "Total Revenue − Total COGS"),
    section("sec-opex", "Operating Expenses"),
    line("rentExpense", "Rent", input.rentExpense),
    line("utilities", "Utilities", input.utilities),
    line("salariesWages", "Salaries/Wages", input.salariesWages),
    line("transportation", "Transportation", input.transportation),
    line("officeSupplies", "Office Supplies", input.officeSupplies),
    line("marketingAdvertising", "Marketing", input.marketingAdvertising),
    line("maintenance", "Maintenance", input.maintenance),
    line("insurance", "Insurance", input.insurance),
    line("subscription", "Subscriptions", input.subscription),
    line("bankCharges", "Bank Charges", input.bankCharges),
    line("miscellaneousExpenses", "Miscellaneous", input.miscellaneousExpenses),
    line(
      "totalOperatingExpenses",
      "Total Operating Expenses",
      input.totalOperatingExpenses,
      "total",
    ),
    line("netProfit", "Net Profit", input.netProfit, "result", "Gross Profit − Operating Expenses"),
    section("sec-below-net", "Cash out"),
    line("loanPrincipalPayment", "Loan Principal", input.loanPrincipalPayment),
    line("capitalPurchase", "Capital Purchase", input.capitalPurchase),
    line(
      "reserveEscrow",
      "Reserve / Escrow",
      input.reserveEscrow,
      "line",
      `Owner-entered in the first month; then ${input.reservePct}% of Total Revenue`,
    ),
    line("ownersWithdrawal", "Owner's Withdrawal", input.ownersWithdrawal),
    line("totalCashPaidOut", "Total Cash Paid Out", input.totalCashPaidOut, "total"),
    line("cashPosition", "Cash Position", input.cashPosition, "result"),
  ];
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
