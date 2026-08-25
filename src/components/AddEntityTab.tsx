"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Uniform “Add …” tab that opens a modal form — same pattern as Inventory.
 */
export function AddEntityTab({
  label,
  title,
  children,
  wide,
}: {
  /** Tab button text, e.g. "Add customer" */
  label: string;
  /** Modal heading; defaults to label */
  title?: string;
  children: ReactNode;
  /** Wider modal for large forms (quotations) */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const heading = title || label;

  return (
    <>
      <div className="inventory-top-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={open}
          className={open ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      </div>

      {open ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="panel add-entity-modal"
            style={{
              padding: "1.25rem",
              width: wide ? "min(920px, 100%)" : "min(720px, 100%)",
              maxHeight: "min(90vh, 920px)",
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
              <h3 id={titleId} style={{ margin: 0 }}>
                {heading}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
