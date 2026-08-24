"use client";

import { deleteQuotation } from "@/app/actions";

export function DeleteQuotationButton({ quotationId }: { quotationId: string }) {
  return (
    <form
      action={deleteQuotation}
      onSubmit={(e) => {
        if (!confirm("Delete this quotation? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="quotationId" value={quotationId} />
      <button type="submit" className="btn btn-danger btn-sm">
        Delete
      </button>
    </form>
  );
}
