"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  completePosSale,
  saveOpenTicket,
  setActivePosRegister,
  voidOpenTicket,
} from "@/app/actions";
import { formatTTD, toCents, fromCents } from "@/lib/money";
import { formatAppDateTime } from "@/lib/timezone";
import { DEFERRED_PAYMENT_CODE, DEFERRED_PAYMENT_LABEL } from "@/lib/receivables";
import type { InventoryViewMode } from "@/lib/settings";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { ItemMenu } from "@/components/ItemMenu";
import {
  findOptionForVariantLabel,
  parseVariantFromDescription,
  resolveOptionUnitPrice,
  type VariableOption,
} from "@/lib/product-variables";

function variantLabelFromSelections(
  vars: ProductVariable[],
  selections: Record<string, string>,
): string {
  return vars.map((v) => `${v.name}: ${selections[v.name]}`).join(", ");
}

function categoryAccent(
  colors: Record<string, string | null | undefined>,
  category: string,
): string {
  return colors[category.toLowerCase()] || "";
}

/** Soft category-tinted background so POS tiles stay readable. */
function categoryTileStyle(color: string): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    background: `color-mix(in srgb, ${color} 48%, var(--tile-bg, #fff))`,
    borderColor: color,
  };
}

function priceDollarsForSelections(p: Product, selections: Record<string, string>): string {
  const vars = p.variables || [];
  if (!vars.length) {
    return p.variablePrice ? "" : (p.unitPrice / 100).toFixed(2);
  }
  const label = variantLabelFromSelections(vars, selections);
  const hit = findOptionForVariantLabel(vars, label);
  const resolved = hit
    ? resolveOptionUnitPrice(hit.option, p.unitPrice, Boolean(p.variablePrice))
    : p.variablePrice
      ? null
      : p.unitPrice;
  if (resolved == null) return "";
  return (resolved / 100).toFixed(2);
}

function availableStockForVariant(p: Product, variantLabel?: string): number {
  if (!p.trackStock || p.isService) return Infinity;
  const vars = p.variables || [];
  if (!vars.length || !variantLabel) return p.stockQty;
  const hit = findOptionForVariantLabel(vars, variantLabel);
  return hit?.option.qty ?? 0;
}

type ProductVariable = { name: string; options: VariableOption[] };

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
  variablePrice?: boolean;
  stockQty: number;
  trackStock: boolean;
  isService: boolean;
  variables?: ProductVariable[];
};

type Customer = { id: string; name: string };

type CartLine = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  variantLabel?: string;
};

type OpenTicket = {
  id: string;
  number: string;
  method: string;
  customerId: string | null;
  customerName: string | null;
  posRegisterId: string | null;
  total: number;
  updatedAt: string;
  lines: { productId: string | null; description: string; quantity: number; unitPrice: number }[];
};

type PaymentTypeOption = { code: string; label: string };
type DiscountOption = { id: string; name: string; percent: number };
type SplitPaymentRow = { id: string; method: string; amount: string };

function lineKey(productId: string, variantLabel?: string) {
  return `${productId}::${variantLabel || ""}`;
}

export function PosTerminal({
  products: initialProducts,
  customers,
  registers = [],
  requireRegister = false,
  openTicketsEnabled = false,
  outOfStockWarn = false,
  paymentTypes = [],
  categoryColors = {},
  openTickets: initialTickets = [],
  discounts = [],
  canVoidTickets = true,
  canManageInventory = true,
  canAdjustStock = true,
  viewMode = "card",
  initialRegisterId = "",
  honeyPersonsEnabled = false,
  taxEnabled = true,
  vatRate = 0.125,
}: {
  products: Product[];
  customers: Customer[];
  registers?: { id: string; name: string }[];
  requireRegister?: boolean;
  openTicketsEnabled?: boolean;
  outOfStockWarn?: boolean;
  paymentTypes?: PaymentTypeOption[];
  categoryColors?: Record<string, string | null | undefined>;
  openTickets?: OpenTicket[];
  discounts?: DiscountOption[];
  canVoidTickets?: boolean;
  canManageInventory?: boolean;
  canAdjustStock?: boolean;
  /** Matches Settings → POS → Inventory View for this store (also used on Inventory). */
  viewMode?: InventoryViewMode;
  initialRegisterId?: string;
  honeyPersonsEnabled?: boolean;
  taxEnabled?: boolean;
  vatRate?: number;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tickets, setTickets] = useState(initialTickets);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState(paymentTypes[0]?.code || "CASH");
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([
    { id: "1", method: paymentTypes[0]?.code || "CASH", amount: "" },
  ]);
  const [deferredDueDate, setDeferredDueDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [posRegisterId, setPosRegisterId] = useState(
    initialRegisterId || registers[0]?.id || "",
  );
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [view, setView] = useState<"sell" | "tickets">("sell");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptHref, setReceiptHref] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [honeyPersons, setHoneyPersons] = useState("");
  const [addModal, setAddModal] = useState<{
    product: Product;
    selections: Record<string, string>;
    priceDollars: string;
    quantity: string;
  } | null>(null);

  useEffect(() => {
    if (!posRegisterId && (initialRegisterId || registers[0]?.id)) {
      setPosRegisterId(initialRegisterId || registers[0]!.id);
    }
  }, [registers, posRegisterId, initialRegisterId]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  useEffect(() => {
    if (paymentTypes.length && !paymentTypes.some((p) => p.code === method)) {
      setMethod(paymentTypes[0]!.code);
    }
  }, [paymentTypes, method]);

  const productCategories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || "General"));
    return ["ALL", ...[...set].sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "ALL" && (p.category || "General") !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, query, categoryFilter]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount =
    taxEnabled !== false ? Math.round(taxable * (vatRate ?? 0.125)) : 0;
  const chargeTotal = taxable + taxAmount;

  const methodOptions = useMemo(() => {
    const base = paymentTypes.length
      ? paymentTypes
      : [
          { code: "CASH", label: "Cash" },
          { code: "CARD", label: "Card" },
          { code: "BANK", label: "Bank transfer" },
        ];
    return [...base, { code: DEFERRED_PAYMENT_CODE, label: DEFERRED_PAYMENT_LABEL }];
  }, [paymentTypes]);

  const splitAllocatedCents = useMemo(
    () =>
      splitRows.reduce((sum, row) => {
        const dollars = Number(row.amount);
        if (!Number.isFinite(dollars) || dollars <= 0) return sum;
        return sum + toCents(dollars);
      }, 0),
    [splitRows],
  );

  const splitRemainingCents = Math.max(0, chargeTotal - splitAllocatedCents);
  const hasDeferredSplit = splitRows.some((row) => row.method === DEFERRED_PAYMENT_CODE);

  function openAddModal(p: Product) {
    const selections: Record<string, string> = {};
    for (const v of p.variables || []) {
      selections[v.name] = v.options[0]?.label || "";
    }
    setAddModal({
      product: p,
      selections,
      priceDollars: priceDollarsForSelections(p, selections),
      quantity: "1",
    });
  }

  function confirmAddModal() {
    if (!addModal) return;
    const p = addModal.product;
    const vars = p.variables || [];
    for (const v of vars) {
      if (!addModal.selections[v.name]?.trim()) {
        setError(`Select ${v.name}`);
        return;
      }
    }
    const qty = Math.max(1, Math.floor(Number(addModal.quantity) || 0));
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Enter a quantity of at least 1");
      return;
    }
    let unitPrice = p.unitPrice;
    const variantLabel = vars
      .map((v) => `${v.name}: ${addModal.selections[v.name]}`)
      .join(", ");
    const hit = findOptionForVariantLabel(vars, variantLabel);
    const resolvedOptionPrice = hit
      ? resolveOptionUnitPrice(hit.option, p.unitPrice, Boolean(p.variablePrice))
      : p.variablePrice
        ? null
        : p.unitPrice;

    if (resolvedOptionPrice != null) {
      unitPrice = resolvedOptionPrice;
    } else if (p.variablePrice) {
      const dollars = Number(addModal.priceDollars);
      if (!Number.isFinite(dollars) || dollars < 0) {
        setError("Enter a valid price");
        return;
      }
      unitPrice = toCents(dollars);
    }
    pushToCart(p, unitPrice, variantLabel || undefined, qty);
    setAddModal(null);
  }

  function pushToCart(p: Product, unitPrice: number, variantLabel?: string, quantity = 1) {
    setMessage(null);
    setError(null);
    setReceiptHref(null);

    const addQty = Math.max(1, Math.floor(quantity) || 1);
    const key = lineKey(p.id, variantLabel);
    const existingQty = cart.find((l) => l.key === key)?.quantity ?? 0;
    const nextQty = existingQty + addQty;
    const available = availableStockForVariant(p, variantLabel);
    if (outOfStockWarn && p.trackStock && !p.isService && available < nextQty) {
      setError(
        `Out of stock: ${p.name}${variantLabel ? ` (${variantLabel})` : ""} (available ${available}). Enable restocking or reduce quantity.`,
      );
      return;
    }

    const displayName = variantLabel ? `${p.name} (${variantLabel})` : p.name;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + addQty, unitPrice } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: p.id,
          name: displayName,
          unitPrice,
          quantity: addQty,
          variantLabel,
        },
      ];
    });
  }

  function addProduct(p: Product) {
    // Always confirm quantity (and options/price when needed) so cashiers can type qty once
    openAddModal(p);
  }

  function updateQty(key: string, quantity: number) {
    const line = cart.find((l) => l.key === key);
    const product = line ? products.find((p) => p.id === line.productId) : undefined;
    const qty = Math.floor(Number(quantity) || 0);
    const available = product ? availableStockForVariant(product, line?.variantLabel) : Infinity;
    if (
      outOfStockWarn &&
      product &&
      product.trackStock &&
      !product.isService &&
      qty > available
    ) {
      setError(`Out of stock: ${product.name} (available ${available}).`);
      return;
    }
    setError(null);
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)).filter((l) => l.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
    setError(null);
    setMessage(null);
  }

  function clearTicket() {
    setCart([]);
    setOpenTicketId(null);
    setCustomerId("");
    setDiscountPercent(0);
    setHoneyPersons("");
    setMessage(null);
    setError(null);
    setReceiptHref(null);
  }

  function loadTicket(ticket: OpenTicket) {
    setView("sell");
    setOpenTicketId(ticket.id);
    setMethod(ticket.method || paymentTypes[0]?.code || "CASH");
    setCustomerId(ticket.customerId || "");
    if (ticket.posRegisterId) setPosRegisterId(ticket.posRegisterId);
    setCart(
      ticket.lines
        .filter((l) => l.productId)
        .map((l) => {
          const product = products.find((p) => p.id === l.productId);
          const variantLabel = product
            ? parseVariantFromDescription(product.name, l.description)
            : undefined;
          return {
            key: lineKey(l.productId!, variantLabel),
            productId: l.productId!,
            name: l.description,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            variantLabel,
          };
        }),
    );
    setMessage(`Editing ticket ${ticket.number}`);
    setError(null);
    setReceiptHref(null);
  }

  function onProductDeleted(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((l) => l.productId !== id));
    router.refresh();
  }

  function onStockAdjusted(
    id: string,
    stockQty: number,
    variables?: { name: string; options: VariableOption[] }[],
  ) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stockQty, ...(variables ? { variables } : {}) } : p,
      ),
    );
    router.refresh();
  }

  const adjustingProduct = adjustingId ? products.find((p) => p.id === adjustingId) : null;

  function cartLinesForServer() {
    return cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      variantLabel: l.variantLabel,
    }));
  }

  function holdTicket() {
    setMessage(null);
    setError(null);
    if (!cart.length) {
      setError("Cart is empty");
      return;
    }
    startTransition(async () => {
      const result = await saveOpenTicket({
        ticketId: openTicketId,
        lines: cartLinesForServer(),
        method,
        customerId: customerId || null,
        posRegisterId: posRegisterId || null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpenTicketId(result.ticketId ?? null);
      setMessage(`Ticket ${result.number} saved`);
      router.refresh();
    });
  }

  function checkout() {
    setMessage(null);
    setError(null);
    setReceiptHref(null);
    if (requireRegister && !posRegisterId) {
      setError("Select a POS register (or name them in Settings → POS)");
      return;
    }
    if (splitPayment) {
      if (splitRemainingCents !== 0) {
        setError("Split payment amounts must equal the sale total");
        return;
      }
      if (hasDeferredSplit && !customerId) {
        setError("Select a customer for deferred payment");
        return;
      }
    }
    startTransition(async () => {
      const payload = {
        lines: cartLinesForServer(),
        customerId: customerId || null,
        posRegisterId: posRegisterId || null,
        ticketId: openTicketId,
        discountPercent,
        honeyPersons: honeyPersonsEnabled ? honeyPersons : null,
        dueDate: hasDeferredSplit ? deferredDueDate || null : null,
      };

      const result = await completePosSale(
        splitPayment
          ? {
              ...payload,
              payments: splitRows
                .map((row) => ({
                  method: row.method,
                  amount: toCents(Number(row.amount) || 0),
                }))
                .filter((row) => row.amount > 0),
            }
          : {
              ...payload,
              method,
            },
      );
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      clearTicket();
      setMessage(`Receipt ${result.number} — ${formatTTD(result.total ?? 0)}`);
      if (result.saleId) setReceiptHref(`/pos/receipt/${result.saleId}`);
      router.refresh();
    });
  }

  function onRegisterChange(id: string) {
    setPosRegisterId(id);
    startTransition(async () => {
      await setActivePosRegister(id);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {openTicketsEnabled ? (
        <div className="settings-tabs" role="tablist">
          <button
            type="button"
            className={view === "sell" ? "settings-tab active" : "settings-tab"}
            onClick={() => setView("sell")}
          >
            New sale
          </button>
          <button
            type="button"
            className={view === "tickets" ? "settings-tab active" : "settings-tab"}
            onClick={() => setView("tickets")}
          >
            Saved tickets ({tickets.length})
          </button>
        </div>
      ) : null}

      {view === "tickets" && openTicketsEnabled ? (
        <div className="panel" style={{ padding: "1.1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem" }}>Saved tickets</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            Open a ticket to edit lines, then charge when the customer is ready.
            {canVoidTickets
              ? ""
              : " This register can save and edit tickets but cannot delete them."}
          </p>
          <div className="stack" style={{ gap: "0.65rem" }}>
            {tickets.map((t) => (
              <div key={t.id} className="settings-list-row">
                <div>
                  <strong>{t.number}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {t.customerName || "Walk-in"} · {formatTTD(t.total)} ·{" "}
                    {formatAppDateTime(new Date(t.updatedAt))}
                  </div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>
                    {t.lines.map((l) => `${l.quantity}× ${l.description}`).join(", ")}
                  </div>
                </div>
                <div className="row" style={{ gap: "0.4rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => loadTicket(t)}
                  >
                    Open
                  </button>
                  {canVoidTickets ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await voidOpenTicket(t.id, posRegisterId || null);
                          if ("error" in result && result.error) {
                            setError(result.error);
                            return;
                          }
                          setTickets((prev) => prev.filter((x) => x.id !== t.id));
                          if (openTicketId === t.id) clearTicket();
                          setMessage(`Voided ${t.number}`);
                          router.refresh();
                        });
                      }}
                    >
                      Void
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {tickets.length === 0 ? (
              <div className="muted">No saved tickets. Hold a cart from New sale to create one.</div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {registers.length > 0 || requireRegister ? (
            <label className="field" style={{ maxWidth: 320 }}>
              Active POS register
              <select
                value={posRegisterId}
                onChange={(e) => onRegisterChange(e.target.value)}
                required={requireRegister}
              >
                {registers.length === 0 ? (
                  <option value="">No registers named yet</option>
                ) : (
                  registers.map((r, idx) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {idx === 0 ? " (full access)" : " (POS + stock)"}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}

          <div className="pos-grid">
            <div className="panel" style={{ padding: "1.1rem" }}>
              <div className="row" style={{ marginBottom: "0.75rem", gap: "0.5rem" }}>
                <input
                  type="search"
                  placeholder="Search products"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ maxWidth: 160 }}
                >
                  {productCategories.map((c) => (
                    <option key={c} value={c}>
                      {c === "ALL" ? "All categories" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div className={viewMode === "list" ? "product-list" : "product-grid"}>
                {filtered.map((p) => {
                  const meta = [
                    p.category,
                    p.trackStock && !p.isService
                      ? `stock ${p.stockQty}`
                      : p.isService
                        ? "service"
                        : null,
                    p.variablePrice ? "price at POS" : null,
                    p.variables?.length ? "options" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const tileStyle = categoryTileStyle(categoryAccent(categoryColors, p.category));

                  if (viewMode === "list") {
                    return (
                      <div key={p.id} className="product-list-row">
                        <button
                          type="button"
                          className="product-list-btn"
                          style={tileStyle}
                          onClick={() => addProduct(p)}
                        >
                          <div>
                            <strong>{p.name}</strong>
                            <div className="muted" style={{ fontSize: "0.78rem", marginTop: "0.15rem" }}>
                              {meta}
                            </div>
                          </div>
                          <div className="money">
                            {p.variablePrice ? "Enter price" : formatTTD(p.unitPrice)}
                          </div>
                        </button>
                        {canAdjustStock || canManageInventory ? (
                          <ItemMenu
                            productId={p.id}
                            productName={p.name}
                            onDeleted={canManageInventory ? onProductDeleted : undefined}
                            onAdjustStock={canAdjustStock ? setAdjustingId : undefined}
                            canAdjustStock={!p.isService && p.trackStock}
                          />
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} className="product-tile-wrap">
                      <button
                        type="button"
                        className="product-tile"
                        style={tileStyle}
                        onClick={() => addProduct(p)}
                      >
                        <strong>{p.name}</strong>
                        <div className="muted" style={{ fontSize: "0.78rem" }}>
                          {meta}
                        </div>
                        <div className="money">
                          {p.variablePrice ? "Enter price" : formatTTD(p.unitPrice)}
                        </div>
                      </button>
                      {canAdjustStock || canManageInventory ? (
                        <ItemMenu
                          productId={p.id}
                          productName={p.name}
                          onDeleted={canManageInventory ? onProductDeleted : undefined}
                          onAdjustStock={canAdjustStock ? setAdjustingId : undefined}
                          canAdjustStock={!p.isService && p.trackStock}
                        />
                      ) : null}
                    </div>
                  );
                })}
                {filtered.length === 0 ? <div className="muted">No products match.</div> : null}
              </div>
            </div>

            <div className="panel" style={{ padding: "1.1rem" }}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem" }}>
                {openTicketId ? "Editing ticket" : "Cart / Ticket"}
              </h2>
              <div className="cart-lines">
                {cart.map((l) => (
                  <div key={l.key} className="cart-line">
                    <div>
                      <strong>{l.name}</strong>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {formatTTD(l.unitPrice)} each
                      </div>
                    </div>
                    <div className="cart-line-actions">
                      <div className="cart-qty" aria-label={`Quantity for ${l.name}`}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm cart-qty-btn"
                          aria-label="Decrease quantity"
                          onClick={() => updateQty(l.key, l.quantity - 1)}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={l.quantity}
                          aria-label="Quantity"
                          onChange={(e) => updateQty(l.key, Number(e.target.value) || 0)}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm cart-qty-btn"
                          aria-label="Increase quantity"
                          onClick={() => updateQty(l.key, l.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="money">{formatTTD(l.unitPrice * l.quantity)}</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => removeLine(l.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 ? (
                  <div className="muted">Tap a product, enter quantity, then add to cart.</div>
                ) : null}
              </div>

              <div className="stack" style={{ marginTop: "1rem" }}>
                <label className="field">
                  Customer (optional)
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Walk-in</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span>Payment</span>
                    <label className="row" style={{ gap: "0.35rem", fontSize: "0.85rem", fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setSplitPayment(enabled);
                          if (enabled) {
                            setSplitRows([
                              {
                                id: "1",
                                method: methodOptions[0]?.code || "CASH",
                                amount: chargeTotal ? fromCents(chargeTotal).toFixed(2) : "",
                              },
                            ]);
                          }
                        }}
                      />
                      Split payment
                    </label>
                  </span>
                  {!splitPayment ? (
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                      {methodOptions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="stack" style={{ gap: "0.5rem" }}>
                      {splitRows.map((row) => (
                        <div key={row.id} className="row" style={{ gap: "0.45rem", alignItems: "end" }}>
                          <label className="field" style={{ flex: 1, margin: 0 }}>
                            Method
                            <select
                              value={row.method}
                              onChange={(e) =>
                                setSplitRows((prev) =>
                                  prev.map((item) =>
                                    item.id === row.id ? { ...item, method: e.target.value } : item,
                                  ),
                                )
                              }
                            >
                              {methodOptions.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field" style={{ width: "7.5rem", margin: 0 }}>
                            Amount
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.amount}
                              onChange={(e) =>
                                setSplitRows((prev) =>
                                  prev.map((item) =>
                                    item.id === row.id ? { ...item, amount: e.target.value } : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          {splitRows.length > 1 ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                setSplitRows((prev) => prev.filter((item) => item.id !== row.id))
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setSplitRows((prev) => [
                              ...prev,
                              {
                                id: String(Date.now()),
                                method: methodOptions[0]?.code || "CASH",
                                amount: splitRemainingCents
                                  ? fromCents(splitRemainingCents).toFixed(2)
                                  : "",
                              },
                            ])
                          }
                        >
                          Add payment
                        </button>
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          Remaining: {formatTTD(splitRemainingCents)}
                        </span>
                      </div>
                      {hasDeferredSplit ? (
                        <label className="field">
                          Due date (deferred)
                          <input
                            type="date"
                            value={deferredDueDate}
                            onChange={(e) => setDeferredDueDate(e.target.value)}
                          />
                        </label>
                      ) : null}
                    </div>
                  )}
                </label>
                <label className="field">
                  Discount
                  <select
                    value={String(discountPercent)}
                    onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                  >
                    <option value="0">No discount</option>
                    {discounts.map((d) => (
                      <option key={d.id} value={String(d.percent)}>
                        {d.name} ({d.percent}%)
                      </option>
                    ))}
                  </select>
                </label>
                {honeyPersonsEnabled ? (
                  <label className="field">
                    Persons involved (honey)
                    <input
                      type="text"
                      value={honeyPersons}
                      onChange={(e) => setHoneyPersons(e.target.value)}
                      placeholder="Names of persons involved"
                    />
                  </label>
                ) : null}
                {discountPercent > 0 ? (
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Discount ({discountPercent}%)</span>
                    <span className="money">−{formatTTD(discountAmount)}</span>
                  </div>
                ) : null}
                {taxAmount > 0 ? (
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Tax</span>
                    <span className="money">{formatTTD(taxAmount)}</span>
                  </div>
                ) : null}
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Total</span>
                  <span className="value money" style={{ fontSize: "1.5rem" }}>
                    {formatTTD(chargeTotal)}
                  </span>
                </div>
                {error ? <div className="badge badge-danger">{error}</div> : null}
                {message ? <div className="badge badge-ok">{message}</div> : null}
                {receiptHref ? (
                  <Link className="btn btn-accent" href={receiptHref}>
                    View / print receipt
                  </Link>
                ) : null}
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!cart.length || pending}
                  onClick={checkout}
                >
                  {pending ? "Processing…" : "Charge & generate receipt"}
                </button>
                {openTicketsEnabled ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={!cart.length || pending}
                    onClick={holdTicket}
                  >
                    {openTicketId ? "Update saved ticket" : "Save as open ticket"}
                  </button>
                ) : null}
                <button className="btn btn-secondary" type="button" onClick={clearTicket}>
                  Clear cart
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {addModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setAddModal(null)}
        >
          <div
            className="panel"
            style={{ padding: "1.25rem", width: "min(420px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{addModal.product.name}</h3>
            <div className="stack" style={{ gap: "0.75rem" }}>
              <label className="field">
                Quantity
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={addModal.quantity}
                  onChange={(e) =>
                    setAddModal((prev) =>
                      prev ? { ...prev, quantity: e.target.value } : prev,
                    )
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmAddModal();
                    }
                  }}
                  autoFocus={!addModal.product.variablePrice}
                />
              </label>
              {(addModal.product.variables || []).map((v) => (
                <label key={v.name} className="field">
                  {v.name}
                  <select
                    value={addModal.selections[v.name] || ""}
                    onChange={(e) =>
                      setAddModal((prev) => {
                        if (!prev) return prev;
                        const selections = { ...prev.selections, [v.name]: e.target.value };
                        return {
                          ...prev,
                          selections,
                          priceDollars: priceDollarsForSelections(prev.product, selections),
                        };
                      })
                    }
                  >
                    {v.options.map((o) => (
                      <option key={o.label} value={o.label}>
                        {o.label}
                        {addModal.product.trackStock && !addModal.product.isService
                          ? ` (${o.qty} in stock)`
                          : ""}
                        {(o.unitPrice ?? 0) > 0 ? ` · ${formatTTD(o.unitPrice!)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {addModal.product.variablePrice &&
              !priceDollarsForSelections(addModal.product, addModal.selections) ? (
                <label className="field">
                  Price
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addModal.priceDollars}
                    onChange={(e) =>
                      setAddModal((prev) =>
                        prev ? { ...prev, priceDollars: e.target.value } : prev,
                      )
                    }
                    placeholder="0.00"
                    autoFocus
                  />
                </label>
              ) : null}
              <div className="row" style={{ gap: "0.5rem" }}>
                <button type="button" className="btn btn-primary" onClick={confirmAddModal}>
                  Add to cart
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAddModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {adjustingProduct ? (
        <AdjustStockModal
          product={adjustingProduct}
          onClose={() => setAdjustingId(null)}
          onAdjusted={onStockAdjusted}
        />
      ) : null}
    </div>
  );
}
