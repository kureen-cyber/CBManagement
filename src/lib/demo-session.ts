import { cookies } from "next/headers";

export const DEMO_SESSION_COOKIE = "cbm_demo_session";
export const DEMO_SESSION_VALUE = "1";
/** Cookie lifetime for interactive demo browsing (4 hours). */
export const DEMO_SESSION_MAX_AGE_SEC = 60 * 60 * 4;

export const DEMO_COMPANY_NAME = "Island Works Demo";
export const DEMO_USER_ID = "demo-interactive";
export const DEMO_USER_EMAIL = "demo@cbmanagement.app";

export function demoSessionCookieOptions(maxAge = DEMO_SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** True when the request carries an interactive demo session cookie. */
export async function hasDemoSession(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}

export function requestHasDemoSession(
  cookieHeaderOrGetter: string | null | undefined | { get: (name: string) => { value: string } | undefined },
): boolean {
  if (!cookieHeaderOrGetter) return false;
  if (typeof cookieHeaderOrGetter === "string") {
    return cookieHeaderOrGetter
      .split(";")
      .some((part) => {
        const [name, ...rest] = part.trim().split("=");
        return name === DEMO_SESSION_COOKIE && rest.join("=") === DEMO_SESSION_VALUE;
      });
  }
  return cookieHeaderOrGetter.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}
