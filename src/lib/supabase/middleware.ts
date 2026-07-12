import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes reachable without a session. Everything else requires auth.
// /reset-password is intentionally not here: it's reached with an active
// recovery session, so the normal auth guard already lets it through.
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/auth"];

// Refreshes the Supabase session on every request and guards protected routes.
// Called from the root middleware.ts.
export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options),
					);
				},
			},
		},
	);

	// IMPORTANT: do not run any code between createServerClient and getUser().
	// getUser() revalidates the token and keeps the session fresh.
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;
	const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
	const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

	// Unauthenticated users may only reach public routes.
	if (!user && !isPublic) {
		const url = request.nextUrl.clone();
		url.pathname = "/sign-in";
		return NextResponse.redirect(url);
	}

	// Authenticated users shouldn't see the sign-in / sign-up pages.
	if (user && isAuthPage) {
		const url = request.nextUrl.clone();
		url.pathname = "/";
		return NextResponse.redirect(url);
	}

	// IMPORTANT: return supabaseResponse as-is so the refreshed auth cookies
	// are sent back to the browser.
	return supabaseResponse;
}
