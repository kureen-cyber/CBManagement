"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/app/actions";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!confirm(`Delete “${customerName}”? This cannot be undone.`)) return;
    setError(null);
    const fd = new FormData();
    fd.set("customerId", customerId);
    startTransition(async () => {
      const result = await deleteCustomer(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: "0.25rem", alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={pending}
        onClick={onDelete}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <div className="muted" style={{ color: "var(--danger)", fontSize: "0.75rem", maxWidth: 220 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
