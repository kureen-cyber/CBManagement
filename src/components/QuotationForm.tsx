"use client";

import { useState } from "react";
import { createQuotation } from "@/app/actions";
import { formatTTD, sellingPriceFromMarkup } from "@/lib/money";

export function QuotationForm({
  customers,
}: {
  customers: { id: string; name: string }[];
}) {
  const [fixedPrice, setFixedPrice] = useState(false);

  return (
    <form action={createQuotation} className="form-grid">
      <label className="field">
        Customer
        <select name="customerId" required defaultValue="">
          <option value="" disabled>
            Select
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Title
        <input name="title" placeholder="Electrical installation" />
      </label>
      <label className="field">
        Labour (TT$)
        <input name="labourCost" type="number" step="0.01" defaultValue="2500" />
      </label>
      <label className="field">
        Materials (TT$)
        <input name="materialsCost" type="number" step="0.01" defaultValue="1800" />
      </label>
      <label className="field">
        Equipment (TT$)
        <input name="equipmentCost" type="number" step="0.01" defaultValue="500" />
      </label>
      <label className="field">
        Transport (TT$)
        <input name="transportCost" type="number" step="0.01" defaultValue="300" />
      </label>

      <label className="choice-card full">
        <input
          type="checkbox"
          name="fixedPrice"
          checked={fixedPrice}
          onChange={(e) => setFixedPrice(e.target.checked)}
        />
        <span>
          <strong>Fixed-price service</strong>
          <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
            Enter a set selling price — markup % is hidden
          </span>
        </span>
      </label>

      {fixedPrice ? (
        <label className="field">
          Fixed price (TT$)
          <input name="fixedPriceAmount" type="number" step="0.01" required defaultValue="5100" />
        </label>
      ) : (
        <>
          <label className="field">
            Markup %
            <input name="markupPct" type="number" step="0.1" defaultValue="25" />
          </label>
          <div className="full muted" style={{ fontSize: "0.85rem" }}>
            Example cost TT$5,100 @ 25% → {formatTTD(sellingPriceFromMarkup(510000, 25))}
          </div>
        </>
      )}

      <div className="full">
        <button className="btn btn-primary" type="submit">
          Save quotation
        </button>
      </div>
    </form>
  );
}
