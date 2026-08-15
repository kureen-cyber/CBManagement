import { cookies } from "next/headers";
import { POS_REGISTER_COOKIE } from "@/lib/register-access";

export async function readActiveRegisterIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(POS_REGISTER_COOKIE)?.value?.trim();
  return v || null;
}
