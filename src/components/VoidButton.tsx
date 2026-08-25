"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voidPosSale } from "@/app/actions";

export function VoidButton({
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
          if (
            !confirm(
              "Void this receipt? Stock will be restored and the sale will be removed from dashboard, reports, and analytics.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await voidPosSale(saleId, posRegisterId);
            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Voiding…" : "Void receipt"}
      </button>
      {error ? <div className="badge badge-danger">{error}</div> : null}
    </div>
  );
}
