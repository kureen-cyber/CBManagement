import { APP_TIMEZONE, ensureAppTimezone } from "@/lib/timezone";

export async function register() {
  ensureAppTimezone();
}

/** Trinidad & Tobago (America/Port_of_Spain). */
export const runtimeTimezone = APP_TIMEZONE;
