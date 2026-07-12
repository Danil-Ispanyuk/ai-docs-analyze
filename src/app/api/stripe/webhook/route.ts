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
	const userId = subscription.metadata?.userId;

	const update = {
		stripe_customer_id: customerId,
		stripe_subscription_id: subscription.id,
		subscription_status: subscription.status,
		plan: planFromSubscriptionStatus(subscription.status),
	};

	// Match by the Stripe customer id persisted at checkout; fall back to the userId
	// stashed in subscription metadata so the plan still lands (and the customer id is
	// backfilled) if the profile never recorded the customer id (TD-18). Returning the
	// affected rows lets us detect — and log — a miss instead of silently no-op'ing.
	const query = userId
		? admin
				.from("profiles")
				.update(update)
				.or(`stripe_customer_id.eq.${customerId},id.eq.${userId}`)
		: admin.from("profiles").update(update).eq("stripe_customer_id", customerId);

	const { data, error } = await query.select("id");
	if (error) throw error;
	if (!data || data.length === 0) {
		console.error(
			`syncSubscription: no profile matched (customer=${customerId}, user=${userId ?? "n/a"})`,
		);
	}
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
					const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
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
