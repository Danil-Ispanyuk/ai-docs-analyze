import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — BYPASSES Row Level Security.
//
// Use ONLY where there is no signed-in user to run under RLS and the target row
// is identified by a trusted external key: the Stripe webhook, which looks up a
// profile by stripe_customer_id and updates its plan. Never import this into a
// user-facing read/write path — those must go through lib/supabase/server.ts
// under the user's session (see CLAUDE.md "Data access").
export function createAdminClient() {
	return createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
}
