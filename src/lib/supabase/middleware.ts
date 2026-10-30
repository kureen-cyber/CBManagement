import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/constants";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "@/lib/demo-session";

function hasInteractiveDemoCookie(request: NextRequest) {
  return request.cookies.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/cron") ||
    path === "/demo" ||
    path.startsWith("/demo/");

  // Local env demo: skip auth entirely so the app can be browsed without sign-in.
  if (isDemoModeEnabled()) {
    if (path.startsWith("/login") || path.startsWith("/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Interactive demo session: browse the seeded demo company without a real login.
  if (hasInteractiveDemoCookie(request)) {
    if (path.startsWith("/login") || path.startsWith("/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Without Supabase: require login unless a demo path/session is active
  if (!isSupabaseConfigured()) {
    if (!isPublic && !path.startsWith("/_next")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in visitors on marketing home go into the app
  if (user && path === "/") {
    const url = request.nextUrl.clone();
    const businessType = String(user.user_metadata?.business_type || "").toUpperCase();
    url.pathname = businessType === "RETAIL" ? "/pos" : "/home";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path.startsWith("/login") || path.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    const businessType = String(user.user_metadata?.business_type || "").toUpperCase();
    url.pathname = businessType === "RETAIL" ? "/pos" : "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
