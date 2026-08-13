import { redirect } from "next/navigation";

/** Demo browsing removed from production — send visitors to sign in. */
export default function DemoRedirectPage() {
  redirect("/login");
}
