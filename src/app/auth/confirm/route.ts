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

	// PKCE flow (Supabase default): the email link routes through /auth/v1/verify,
	// which hands us back a one-time `code` to exchange for a session. Recovery
	// links arrive this way, so we must handle it — otherwise the valid code is
	// dropped and the (now consumed) link looks "expired" on the next click.
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	// OTP flow: used when the email template links here directly with a token_hash.
	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({
			type,
			token_hash: tokenHash,
		});
		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	// A failed/expired recovery link should send the user back to request a new
	// one, not to sign-in. In the PKCE flow there's no `type`, so also infer
	// recovery from the destination (`next` → /reset-password).
	if (type === "recovery" || next.startsWith("/reset-password")) {
		return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
	}

	return NextResponse.redirect(
		`${origin}/sign-in?error=${encodeURIComponent("Email link is invalid or has expired.")}`,
	);
}
