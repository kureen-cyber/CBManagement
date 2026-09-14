import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Expenses moved under Payments → Outgoing → Operational. */
export default function ExpensesPage() {
  redirect("/payments");
}
