"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completePosSale, createCustomer, createProduct } from "@/app/actions";
import { formatTTD } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { CategoryInput } from "@/components/CategoryInput";
import { ItemMenu } from "@/components/ItemMenu";

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  stockQty: number;
  trackStock: boolean;
  isService: boolean;
};

type Customer = { id: string; name: string };

type CartLine = { productId: string; name: string; unitPrice: number; quantity: number };

export function PosTerminal({
  products: initialProducts,
  customers,
  retailMode = false,
  registers = [],
  requireRegister = false,
}: {
  products: Product[];
  customers: Customer[];
  retailMode?: boolean;
  registers?: { id: string; name: string }[];
  requireRegister?: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("CASH");
  const [customerId, setCustomerId] = useState("");
  const [posRegisterId, setPosRegisterId] = useState(registers[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptHref, setReceiptHref] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [registerAsService, setRegisterAsService] = useState(false);

  useEffect(() => {
    if (!posRegisterId && registers[0]?.id) setPosRegisterId(registers[0].id);
  }, [registers, posRegisterId]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const categories = useMemo(() => {
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

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function addProduct(p: Product) {
    setMessage(null);
    setError(null);
    setReceiptHref(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, unitPrice: p.unitPrice, quantity: 1 },
      ];
    });
  }

  function updateQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function onProductDeleted(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((l) => l.productId !== id));
    router.refresh();
  }

  function onCreateProduct(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const created = await createProduct(formData);
      if (created?.id) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === created.id)) return prev;
          return [
            ...prev,
            {
              id: created.id,
              name: created.name,
              category: created.category,
              unit: created.unit,
              unitPrice: created.unitPrice,
              stockQty: created.stockQty,
              trackStock: created.trackStock,
              isService: created.isService,
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

  function checkout() {
    setMessage(null);
    setError(null);
    setReceiptHref(null);
    if (requireRegister && !posRegisterId) {
      setError("Select a POS register (or name them in Settings → POS registers)");
      return;
    }
    startTransition(async () => {
      const result = await completePosSale({
        lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        method,
        customerId: customerId || null,
        posRegisterId: posRegisterId || null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setCart([]);
      setMessage(`Receipt ${result.number} — ${formatTTD(result.total ?? 0)}`);
      if (result.saleId) setReceiptHref(`/pos/receipt/${result.saleId}`);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {registers.length > 0 || requireRegister ? (
        <label className="field" style={{ maxWidth: 320 }}>
          Active POS register
          <select
            value={posRegisterId}
            onChange={(e) => setPosRegisterId(e.target.value)}
            required={requireRegister}
          >
            {registers.length === 0 ? (
              <option value="">No registers named yet</option>
            ) : (
              registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))
            )}
          </select>
        </label>
      ) : null}

      {retailMode ? (
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

      {showCustomerForm ? (
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

      {showProductForm ? (
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
                defaultValue="General"
                suggestions={[...PRODUCT_CATEGORIES, ...products.map((p) => p.category)]}
                listId="pos-category-suggestions"
              />
            </label>
            <label className="field">
              SKU
              <input name="sku" placeholder="SKU-001" />
            </label>
            <label className="field">
              Unit price (TT$)
              <input name="unitPrice" type="number" step="0.01" defaultValue="10" required />
            </label>
            <label className="field">
              Unit cost (TT$)
              <input name="unitCost" type="number" step="0.01" defaultValue="6" />
            </label>
            {!registerAsService ? (
              <>
                <label className="field">
                  Opening stock
                  <input name="stockQty" type="number" step="1" defaultValue="20" />
                </label>
                <label className="field">
                  Min stock
                  <input name="minStock" type="number" step="1" defaultValue="5" />
                </label>
              </>
            ) : null}
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                name="isService"
                type="checkbox"
                checked={registerAsService}
                onChange={(e) => setRegisterAsService(e.target.checked)}
              />
              Fixed-price service (lists on POS)
            </label>
            <input type="hidden" name="unit" value="each" />
            {!registerAsService ? <input type="hidden" name="trackStock" value="on" /> : null}
            <div className="full">
              <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="pos-layout">
        <div className="stack">
          <div className="row">
            <input
              placeholder="Search products or services…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All categories" : c}
                </option>
              ))}
            </select>
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <div key={p.id} className="product-tile-wrap">
                <ItemMenu
                  productId={p.id}
                  productName={p.name}
                  onDeleted={onProductDeleted}
                />
                <button
                  type="button"
                  className="product-tile"
                  onClick={() => addProduct(p)}
                >
                  <div className="name">{p.name}</div>
                  <div className="meta money">{formatTTD(p.unitPrice)}</div>
                  <div className="meta">
                    {p.category}
                    {" · "}
                    {p.isService || !p.trackStock
                      ? "Service"
                      : `Stock ${p.stockQty} ${p.unit}`}
                  </div>
                </button>
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="muted">No products match.</div>
            ) : null}
          </div>
        </div>

        <div className="panel" style={{ padding: "1.1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem" }}>Cart / Ticket</h2>
          <div className="cart-lines">
            {cart.map((l) => (
              <div key={l.productId} className="cart-line">
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
                    onChange={(e) => updateQty(l.productId, Number(e.target.value) || 0)}
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
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK">Bank transfer</option>
              </select>
            </label>
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
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!cart.length || pending}
              onClick={() => setCart([])}
            >
              Clear cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
