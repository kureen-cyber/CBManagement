"use client";

export function PrintButton({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) {
    return (
      <button className="btn btn-secondary" type="button" disabled title="Enable receipt printing in Settings → Printers">
        Printing disabled
      </button>
    );
  }

  return (
    <button className="btn btn-primary" type="button" onClick={() => window.print()}>
      Print receipt
    </button>
  );
}
