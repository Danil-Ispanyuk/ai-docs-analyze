import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/config/supabase/server";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = new URL(request.url);
	const tokenHash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;
	const code = searchParams.get("code");
	const next = searchParams.get("next") ?? "/";

	const supabase = await createClient();

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({
			type,
			token_hash: tokenHash,
		});
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	if (type === "recovery" || next.startsWith("/reset-password")) {
		return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
	}

	return NextResponse.redirect(
		`${origin}/sign-in?error=${encodeURIComponent("Email link is invalid or has expired.")}`,
	);
}
