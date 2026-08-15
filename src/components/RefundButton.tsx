"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refundPosSale } from "@/app/actions";

export function RefundButton({
  saleId,
  posRegisterId,
  disabled,
}: {
  saleId: string;
  posRegisterId?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (disabled) return null;

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => {
          if (!confirm("Issue a full refund for this sale? Stock will be restored.")) return;
          setError(null);
          startTransition(async () => {
            const result = await refundPosSale(saleId, posRegisterId);
            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }
            router.push(`/pos/receipt/${result.saleId}`);
            router.refresh();
          });
        }}
      >
        {pending ? "Refunding…" : "Issue refund"}
      </button>
      {error ? <div className="badge badge-danger">{error}</div> : null}
    </div>
  );
}
