"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLimitedCashierPathAllowed } from "@/lib/register-access";

export function RegisterAccessGate({ limited }: { limited: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!limited) return;
    if (!isLimitedCashierPathAllowed(pathname)) router.replace("/pos");
  }, [limited, pathname, router]);

  return null;
}
