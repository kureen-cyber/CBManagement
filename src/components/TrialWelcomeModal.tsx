"use client";

import { useState, useTransition } from "react";
import { acknowledgeTrialWelcome } from "@/app/actions/trial";
import { formatAppDate } from "@/lib/timezone";

export function TrialWelcomeModal({
  trialEndsAt,
}: {
  trialEndsAt: Date | string;
}) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const endLabel = formatAppDate(new Date(trialEndsAt));

  function dismiss() {
    startTransition(async () => {
      await acknowledgeTrialWelcome();
      setOpen(false);
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-welcome-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: "1rem",
      }}
    >
      <div
        className="panel"
        style={{
          padding: "1.5rem",
          width: "min(480px, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trial-welcome-title" style={{ margin: "0 0 0.75rem", fontSize: "1.25rem" }}>
          Your free 30-day trial has now begun
        </h2>
        <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.5 }}>
          You have full access to Complete Business Management for the next 30 days. Your trial
          ends on <strong>{endLabel}</strong>.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={dismiss}
        >
          {pending ? "Starting…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
