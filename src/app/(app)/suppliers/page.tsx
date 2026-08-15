import { redirect } from "next/navigation";

/** Suppliers removed from this app version. */
export default function SuppliersPage() {
  redirect("/inventory");
}
