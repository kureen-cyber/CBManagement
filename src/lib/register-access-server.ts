import { cookies } from "next/headers";
import { POS_REGISTER_COOKIE } from "@/lib/register-access";
import { POS_STORE_COOKIE } from "@/lib/store";

export async function readActiveRegisterIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(POS_REGISTER_COOKIE)?.value?.trim();
  return v || null;
}

export async function readActiveStoreIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(POS_STORE_COOKIE)?.value?.trim();
  return v || null;
}
