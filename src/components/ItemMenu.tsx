"use client";

import { useEffect, useId, useRef, useState, useTransition, type MouseEvent } from "react";
import { deleteProduct } from "@/app/actions";

export function ItemMenu({
  productId,
  productName,
  onDeleted,
}: {
  productId: string;
  productName: string;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: globalThis.MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onDelete(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete “${productName}” from inventory?`)) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDeleted?.(productId);
    });
  }

  return (
    <div className="item-menu" ref={rootRef}>
      <button
        type="button"
        className="item-menu-trigger"
        aria-label={`Actions for ${productName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="item-menu-dropdown" role="menu" id={menuId}>
          <button
            type="button"
            role="menuitem"
            className="item-menu-danger"
            disabled={pending}
            onClick={onDelete}
          >
            {pending ? "Deleting…" : "Delete item"}
          </button>
          {error ? <div className="item-menu-error">{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
