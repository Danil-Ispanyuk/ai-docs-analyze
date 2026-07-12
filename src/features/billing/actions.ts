"use server";

import { createClient } from "@/shared/config/supabase/server";
import { stripe, STRIPE_PRICE_ID } from "@/features/billing/stripe";
import { getCurrentUser } from "@/features/auth/service";

// Start a hosted Stripe Checkout (subscription) for the Pro plan and return its
// URL. The client redirects the browser there; the webhook flips profiles.plan
// once payment succeeds (see app/api/stripe/webhook/route.ts).
export async function createCheckoutSession(): Promise<{ url?: string; error?: string }> {
	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return { error: "Not authenticated" };

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan, stripe_customer_id")
		.eq("id", user.id)
		.single();

	if (profile?.plan === "pro") return { error: "You are already on the Pro plan." };

	// Reuse the Stripe customer if we have one, otherwise create it and remember
	// the id on the profile (owner can update their own row under RLS).
	let customerId = profile?.stripe_customer_id ?? undefined;
	if (!customerId) {
		const customer = await stripe.customers.create({
			email: user.email ?? undefined,
			metadata: { userId: user.id },
		});
		customerId = customer.id;
		await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
	}

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

	try {
		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			customer: customerId,
			line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
			// Redundant safety net so the webhook can always resolve the user.
			subscription_data: { metadata: { userId: user.id } },
			success_url: `${appUrl}/?checkout=success`,
			cancel_url: `${appUrl}/?checkout=cancel`,
		});
		if (!session.url) return { error: "Could not start checkout." };
		return { url: session.url };
	} catch (error) {
		console.error("createCheckoutSession failed:", error);
		return { error: error instanceof Error ? error.message : "Could not start checkout." };
	}
}
