"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completePosSale,
  createCustomer,
  createProduct,
  saveOpenTicket,
  setActivePosRegister,
  voidOpenTicket,
} from "@/app/actions";
import { formatTTD, toCents } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { InventoryViewMode } from "@/lib/settings";
import { CategoryInput } from "@/components/CategoryInput";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { ItemMenu } from "@/components/ItemMenu";

type ProductVariable = { name: string; options: string[] };

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

function lineKey(productId: string, variantLabel?: string) {
  return `${productId}::${variantLabel || ""}`;
}

function extractVariant(productName: string, description: string): string | undefined {
  const prefix = `${productName} (`;
  if (description.startsWith(prefix) && description.endsWith(")")) {
    return description.slice(prefix.length, -1);
  }
  return undefined;
}

export function PosTerminal({
  products: initialProducts,
  customers,
  retailMode = false,
  registers = [],
  requireRegister = false,
  openTicketsEnabled = false,
  outOfStockWarn = false,
  paymentTypes = [],
  categories = [],
  openTickets: initialTickets = [],
  discounts = [],
  canVoidTickets = true,
  canManageInventory = true,
  viewMode = "card",
  initialRegisterId = "",
  honeyPersonsEnabled = false,
}: {
  products: Product[];
  customers: Customer[];
  retailMode?: boolean;
  registers?: { id: string; name: string }[];
  requireRegister?: boolean;
  openTicketsEnabled?: boolean;
  outOfStockWarn?: boolean;
  paymentTypes?: PaymentTypeOption[];
  categories?: string[];
  openTickets?: OpenTicket[];
  discounts?: DiscountOption[];
  canVoidTickets?: boolean;
  canManageInventory?: boolean;
  /** Matches Settings → POS → Inventory View for this store (also used on Inventory). */
  viewMode?: InventoryViewMode;
  initialRegisterId?: string;
  honeyPersonsEnabled?: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tickets, setTickets] = useState(initialTickets);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState(paymentTypes[0]?.code || "CASH");
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
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [registerAsService, setRegisterAsService] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [honeyPersons, setHoneyPersons] = useState("");
  const [addModal, setAddModal] = useState<{
    product: Product;
    selections: Record<string, string>;
    priceDollars: string;
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

  const categorySuggestions = categories.length
    ? categories
    : [...PRODUCT_CATEGORIES, ...products.map((p) => p.category)];

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
  const total = Math.max(0, subtotal - discountAmount);

  function needsAddModal(p: Product) {
    return Boolean(p.variablePrice) || Boolean(p.variables?.length);
  }

  function openAddModal(p: Product) {
    const selections: Record<string, string> = {};
    for (const v of p.variables || []) {
      selections[v.name] = v.options[0] || "";
    }
    setAddModal({
      product: p,
      selections,
      priceDollars: p.variablePrice ? "" : (p.unitPrice / 100).toFixed(2),
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
    let unitPrice = p.unitPrice;
    if (p.variablePrice) {
      const dollars = Number(addModal.priceDollars);
      if (!Number.isFinite(dollars) || dollars < 0) {
        setError("Enter a valid price");
        return;
      }
      unitPrice = toCents(dollars);
    }
    const variantLabel = vars
      .map((v) => `${v.name}: ${addModal.selections[v.name]}`)
      .join(", ");
    pushToCart(p, unitPrice, variantLabel || undefined);
    setAddModal(null);
  }

  function pushToCart(p: Product, unitPrice: number, variantLabel?: string) {
    setMessage(null);
    setError(null);
    setReceiptHref(null);

    const key = lineKey(p.id, variantLabel);
    const existingQty = cart.find((l) => l.key === key)?.quantity ?? 0;
    const nextQty = existingQty + 1;
    if (outOfStockWarn && p.trackStock && !p.isService && p.stockQty < nextQty) {
      setError(
        `Out of stock: ${p.name} (available ${p.stockQty}). Enable restocking or reduce quantity.`,
      );
      return;
    }

    const displayName = variantLabel ? `${p.name} (${variantLabel})` : p.name;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          productId: p.id,
          name: displayName,
          unitPrice,
          quantity: 1,
          variantLabel,
        },
      ];
    });
  }

  function addProduct(p: Product) {
    if (needsAddModal(p)) {
      openAddModal(p);
      return;
    }
    pushToCart(p, p.unitPrice);
  }

  function updateQty(key: string, quantity: number) {
    const line = cart.find((l) => l.key === key);
    const product = line ? products.find((p) => p.id === line.productId) : undefined;
    if (
      outOfStockWarn &&
      product &&
      product.trackStock &&
      !product.isService &&
      quantity > product.stockQty
    ) {
      setError(`Out of stock: ${product.name} (available ${product.stockQty}).`);
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity } : l)).filter((l) => l.quantity > 0),
    );
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
            ? extractVariant(product.name, l.description)
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

  function onStockAdjusted(id: string, stockQty: number) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stockQty } : p)));
    router.refresh();
  }

  const adjustingProduct = adjustingId ? products.find((p) => p.id === adjustingId) : null;

  function onCreateProduct(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const created = await createProduct(formData);
      if (created && "error" in created && created.error) {
        setError(created.error);
        return;
      }
      if (created && "id" in created && created.id) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === created.id)) return prev;
          return [
            ...prev,
            {
              id: created.id,
              name: created.name,
              category: created.category,
              unit: created.unit,
              unitCost: created.unitCost,
              unitPrice: created.unitPrice,
              variablePrice: created.variablePrice,
              stockQty: created.stockQty,
              trackStock: created.trackStock,
              isService: created.isService,
              variables: created.variables,
            },
          ].sort((a, b) => a.name.localeCompare(b.name));
        });
        setShowProductForm(false);
        setRegisterAsService(false);
        setMessage(`Added ${created.name} to inventory`);
      }
      router.refresh();
    });
  }

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
    startTransition(async () => {
      const result = await completePosSale({
        lines: cartLinesForServer(),
        method,
        customerId: customerId || null,
        posRegisterId: posRegisterId || null,
        ticketId: openTicketId,
        discountPercent,
        honeyPersons: honeyPersonsEnabled ? honeyPersons : null,
      });
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
                    {new Date(t.updatedAt).toLocaleString("en-TT")}
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

          {retailMode && canManageInventory ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowCustomerForm((v) => !v);
                  setShowProductForm(false);
                }}
              >
                Register customer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowProductForm((v) => !v);
                  setShowCustomerForm(false);
                }}
              >
                Register inventory
              </button>
              <a className="btn btn-secondary btn-sm" href="/api/inventory/export">
                Export stock list
              </a>
            </div>
          ) : null}

          {showCustomerForm && canManageInventory ? (
            <div className="panel" style={{ padding: "1rem" }}>
              <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Register customer</h3>
              <form action={createCustomer} className="form-grid" autoComplete="off">
                <label className="field">
                  Name
                  <input name="name" required placeholder="Walk-in regular" autoComplete="organization" />
                </label>
                <label className="field">
                  Phone
                  <input name="phone" placeholder="868-555-0100" autoComplete="off" />
                </label>
                <label className="field">
                  Email
                  <input name="email" type="email" autoComplete="off" />
                </label>
                <div className="full">
                  <button className="btn btn-primary btn-sm" type="submit">
                    Save customer
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {showProductForm && canManageInventory ? (
            <div className="panel" style={{ padding: "1rem" }}>
              <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Register inventory / service</h3>
              <form action={onCreateProduct} className="form-grid">
                <label className="field">
                  Name
                  <input name="name" required placeholder="Soft drink or Oil change" />
                </label>
                <label className="field">
                  Category
                  <CategoryInput
                    name="category"
                    defaultValue={categorySuggestions[0] || "General"}
                    suggestions={categorySuggestions}
                    listId="pos-category-suggestions"
                  />
                </label>
                <label className="field">
                  Unit price (leave 0 for variable at POS)
                  <input name="unitPrice" type="number" step="0.01" defaultValue="0" />
                </label>
                <label className="field">
                  Opening stock
                  <input
                    name="stockQty"
                    type="number"
                    step="0.01"
                    defaultValue="0"
                    disabled={registerAsService}
                  />
                </label>
                <label className="choice-card full">
                  <input
                    type="checkbox"
                    name="isService"
                    checked={registerAsService}
                    onChange={(e) => setRegisterAsService(e.target.checked)}
                  />
                  <span>Service (fixed price, no stock)</span>
                </label>
                {!registerAsService ? (
                  <label className="choice-card full">
                    <input type="checkbox" name="trackStock" defaultChecked />
                    <span>Track stock</span>
                  </label>
                ) : null}
                <div className="full">
                  <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                    Save item
                  </button>
                </div>
              </form>
            </div>
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

                  if (viewMode === "list") {
                    return (
                      <div key={p.id} className="product-list-row">
                        <button
                          type="button"
                          className="product-list-btn"
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
                        {canManageInventory ? (
                          <ItemMenu
                            productId={p.id}
                            productName={p.name}
                            onDeleted={onProductDeleted}
                            onAdjustStock={setAdjustingId}
                            canAdjustStock={!p.isService && p.trackStock}
                          />
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} className="product-tile-wrap">
                      <button type="button" className="product-tile" onClick={() => addProduct(p)}>
                        <strong>{p.name}</strong>
                        <div className="muted" style={{ fontSize: "0.78rem" }}>
                          {meta}
                        </div>
                        <div className="money">
                          {p.variablePrice ? "Enter price" : formatTTD(p.unitPrice)}
                        </div>
                      </button>
                      {canManageInventory ? (
                        <ItemMenu
                          productId={p.id}
                          productName={p.name}
                          onDeleted={onProductDeleted}
                          onAdjustStock={setAdjustingId}
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
                    <div className="row">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={l.quantity}
                        style={{ width: 72 }}
                        onChange={(e) => updateQty(l.key, Number(e.target.value) || 0)}
                      />
                      <span className="money">{formatTTD(l.unitPrice * l.quantity)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 ? <div className="muted">Tap products to add.</div> : null}
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
                  Payment method
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {(paymentTypes.length
                      ? paymentTypes
                      : [
                          { code: "CASH", label: "Cash" },
                          { code: "CARD", label: "Card" },
                          { code: "BANK", label: "Bank transfer" },
                        ]
                    ).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
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
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Total</span>
                  <span className="value money" style={{ fontSize: "1.5rem" }}>
                    {formatTTD(total)}
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
              {(addModal.product.variables || []).map((v) => (
                <label key={v.name} className="field">
                  {v.name}
                  <select
                    value={addModal.selections[v.name] || ""}
                    onChange={(e) =>
                      setAddModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              selections: { ...prev.selections, [v.name]: e.target.value },
                            }
                          : prev,
                      )
                    }
                  >
                    {v.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {addModal.product.variablePrice ? (
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
