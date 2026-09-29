"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateJobNotes } from "@/app/actions";
import { Panel } from "@/components/ui";

export function JobNotesPanel({
  jobId,
  notes,
}: {
  jobId: string;
  notes: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    fd.set("jobId", jobId);
    startTransition(async () => {
      try {
        await updateJobNotes(fd);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save notes");
      }
    });
  }

  return (
    <Panel style={{ padding: "1.25rem" }}>
      <form className="stack" onSubmit={onSave} autoComplete="off">
        <label className="field">
          Job notes
          <textarea
            name="notes"
            rows={10}
            defaultValue={notes}
            placeholder="Site instructions, materials to pick up, customer requests…"
          />
        </label>
        {error ? (
          <div className="info-banner" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}
        {saved ? <p className="muted" style={{ margin: 0 }}>Notes saved.</p> : null}
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save notes"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
