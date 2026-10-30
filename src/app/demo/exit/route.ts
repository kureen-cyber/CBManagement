import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, demoSessionCookieOptions } from "@/lib/demo-session";

/** End the interactive demo session and return to the marketing site. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    ...demoSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
