import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/constants";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/cron");

  // Local demo: skip auth entirely so the app can be browsed without sign-in.
  if (isDemoModeEnabled()) {
    if (path.startsWith("/login") || path.startsWith("/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      url.search = "";
      return NextResponse.redirect(url);
    }
    supabaseResponse.headers.set("x-pathname", path);
    return supabaseResponse;
  }

  // Without Supabase: require login unless demo mode is explicitly enabled
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

  supabaseResponse.headers.set("x-pathname", path);
  return supabaseResponse;
}
