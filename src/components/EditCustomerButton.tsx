"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/app/actions";

export function EditCustomerButton({
  customer,
}: {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateCustomer(fd);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save customer");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Edit
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="panel add-entity-modal"
            style={{
              padding: "1.25rem",
              width: "min(560px, 100%)",
              maxHeight: "min(90vh, 720px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3 id="edit-customer-title" style={{ margin: 0 }}>
                Edit customer
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {error ? (
              <div
                className="info-banner"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "0.75rem" }}
              >
                {error}
              </div>
            ) : null}

            <form className="form-grid" onSubmit={onSubmit} autoComplete="off">
              <input type="hidden" name="customerId" value={customer.id} />
              <label className="field">
                Name
                <input name="name" required defaultValue={customer.name} autoComplete="organization" />
              </label>
              <label className="field">
                Phone
                <input name="phone" defaultValue={customer.phone ?? ""} autoComplete="off" />
              </label>
              <label className="field">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={customer.email ?? ""}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                Address
                <input name="address" defaultValue={customer.address ?? ""} autoComplete="off" />
              </label>
              <label className="field full">
                Notes
                <textarea name="notes" rows={2} defaultValue={customer.notes ?? ""} autoComplete="off" />
              </label>
              <div className="full row" style={{ gap: "0.5rem" }}>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
