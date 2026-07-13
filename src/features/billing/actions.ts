"use server";

import { createClient } from "@/shared/config/supabase/server";
import { stripe, STRIPE_PRICE_ID } from "@/features/billing/stripe";
import { getCurrentUser } from "@/features/auth/service";

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
			client_reference_id: user.id,
			metadata: { userId: user.id },
			line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
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
