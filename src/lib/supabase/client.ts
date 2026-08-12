import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/constants";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Use Demo mode or set env vars.");
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
