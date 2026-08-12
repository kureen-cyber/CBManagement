"use client";

import { useMemo, useState, useTransition } from "react";
import { completePosSale } from "@/app/actions";
import { formatTTD } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  stockQty: number;
  trackStock: boolean;
  isService: boolean;
};

type Customer = { id: string; name: string };

type CartLine = { productId: string; name: string; unitPrice: number; quantity: number };

export function PosTerminal({
  products,
  customers,
}: {
  products: Product[];
  customers: Customer[];
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("CASH");
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function addProduct(p: Product) {
    setMessage(null);
    setError(null);
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

  function checkout() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await completePosSale({
        lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        method,
        customerId: customerId || null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setCart([]);
      setMessage(`Sale ${result.number} completed — ${formatTTD(result.total ?? 0)}`);
    });
  }

  return (
    <div className="pos-layout">
      <div className="stack">
        <input
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="product-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="product-tile"
              onClick={() => addProduct(p)}
            >
              <div className="name">{p.name}</div>
              <div className="meta money">{formatTTD(p.unitPrice)}</div>
              <div className="meta">
                {p.isService || !p.trackStock
                  ? "Service"
                  : `Stock ${p.stockQty} ${p.unit}`}
              </div>
            </button>
          ))}
          {filtered.length === 0 ? (
            <div className="muted">No products match.</div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ padding: "1.1rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem" }}>Cart</h2>
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
          <button
            className="btn btn-primary"
            type="button"
            disabled={!cart.length || pending}
            onClick={checkout}
          >
            {pending ? "Processing…" : "Complete sale"}
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
  );
}
