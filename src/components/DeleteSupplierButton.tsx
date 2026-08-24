"use client";

import { deleteSupplier } from "@/app/actions";

export function DeleteSupplierButton({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  return (
    <form
      action={deleteSupplier}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete “${supplierName}” and their supply database? This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="supplierId" value={supplierId} />
      <button type="submit" className="btn btn-danger btn-sm">
        Delete
      </button>
    </form>
  );
}
