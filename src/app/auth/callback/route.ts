import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/shared/config/supabase/server";

// Copy the confirmed user's email / full name onto their profile row. The
// handle_new_user insert trigger runs at sign-up, before email confirmation, when
// auth.users.email can still be null — so the profile can start blank (TD-20). Now
// that we have a session, backfill it (idempotent; runs under the user's own RLS).
async function backfillProfile(supabase: SupabaseClient) {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	const fullName = (user.user_metadata?.full_name as string | undefined) ?? undefined;
	await supabase
		.from("profiles")
		.update({ email: user.email ?? null, ...(fullName ? { full_name: fullName } : {}) })
		.eq("id", user.id);
}

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const next = searchParams.get("next") ?? "/";

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			await backfillProfile(supabase);
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	return NextResponse.redirect(
		`${origin}/sign-in?error=${encodeURIComponent("Could not sign in.")}`,
	);
}
