import type Stripe from "stripe";
import { stripe, planFromSubscriptionStatus } from "@/features/billing/stripe";
import { createAdminClient } from "@/shared/config/supabase/admin";

// Stripe needs the raw request body to verify the signature, so this route must
// run on the Node runtime and read req.text() (never req.json()).
export const runtime = "nodejs";

// Write the subscription's state onto the matching profile (looked up by the
// Stripe customer id). Runs under the service role — there is no user session on
// a webhook — so it bypasses RLS by design (see lib/supabase/admin.ts).
async function syncSubscription(subscription: Stripe.Subscription) {
	const admin = createAdminClient();
	const customerId =
		typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

	await admin
		.from("profiles")
		.update({
			stripe_subscription_id: subscription.id,
			subscription_status: subscription.status,
			plan: planFromSubscriptionStatus(subscription.status),
		})
		.eq("stripe_customer_id", customerId);
}

export async function POST(req: Request) {
	const body = await req.text();
	const signature = req.headers.get("stripe-signature");
	if (!signature) return new Response("Missing signature", { status: 400 });

	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(
			body,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET!,
		);
	} catch (error) {
		console.error("Stripe webhook signature verification failed:", error);
		return new Response("Invalid signature", { status: 400 });
	}

	try {
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				if (session.subscription) {
					const subscription = await stripe.subscriptions.retrieve(
						session.subscription as string,
					);
					await syncSubscription(subscription);
				}
				break;
			}
			case "customer.subscription.updated":
			case "customer.subscription.deleted": {
				await syncSubscription(event.data.object);
				break;
			}
		}
	} catch (error) {
		// Log and 500 so Stripe retries — the DB write is the only failure mode here.
		console.error(`Stripe webhook handler failed for ${event.type}:`, error);
		return new Response("Webhook handler error", { status: 500 });
	}

	return new Response(null, { status: 200 });
}
