import type Stripe from "stripe";
import { stripe, planFromSubscriptionStatus } from "@/features/billing/stripe";
import { createAdminClient } from "@/shared/config/supabase/admin";

export const runtime = "nodejs";

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
		console.error(`Stripe webhook handler failed for ${event.type}:`, error);
		return new Response("Webhook handler error", { status: 500 });
	}

	return new Response(null, { status: 200 });
}
