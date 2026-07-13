import { createClient } from "@/shared/config/supabase/server";
import { stripe } from "@/features/billing/stripe";
import type { Plan } from "@/features/billing/service";
import { PLAN_TYPES } from "@/shared/constants/general";

export interface InvoiceSummary {
	id: string;
	number: string | null;
	amount: number;
	currency: string;
	status: string | null;
	createdAt: number;
	hostedInvoiceUrl: string | null;
}

export interface BillingOverview {
	plan: Plan;
	subscriptionStatus: string | null;
	hasSubscription: boolean;
	cancelAtPeriodEnd: boolean;
	renewalDate: number | null;
	invoices: InvoiceSummary[];
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
	const supabase = await createClient();

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan, subscription_status, stripe_customer_id, stripe_subscription_id")
		.eq("id", userId)
		.single();

	const plan = (profile?.plan ?? PLAN_TYPES.FREE) as Plan;

	let invoices: InvoiceSummary[] = [];
	if (profile?.stripe_customer_id) {
		const list = await stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 12 });
		invoices = list.data.map((invoice) => ({
			id: invoice.id ?? "",
			number: invoice.number,
			amount: invoice.amount_paid,
			currency: invoice.currency,
			status: invoice.status,
			createdAt: invoice.created * 1000,
			hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
		}));
	}

	let cancelAtPeriodEnd = false;
	let renewalDate: number | null = null;
	if (profile?.stripe_subscription_id) {
		const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
		cancelAtPeriodEnd = subscription.cancel_at_period_end;
		const periodEnd =
			subscription.items?.data?.[0]?.current_period_end ??
			(subscription as { current_period_end?: number }).current_period_end ??
			null;
		renewalDate = periodEnd ? periodEnd * 1000 : null;
	}

	return {
		plan,
		subscriptionStatus: profile?.subscription_status ?? null,
		hasSubscription: Boolean(profile?.stripe_subscription_id),
		cancelAtPeriodEnd,
		renewalDate,
		invoices,
	};
}
