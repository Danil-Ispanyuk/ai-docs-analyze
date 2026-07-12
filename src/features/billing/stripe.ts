import Stripe from "stripe";
import type { Plan } from "@/features/billing/service";
import { PLAN_TYPES } from "@/shared/constants/general";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID!;

export function planFromSubscriptionStatus(status: Stripe.Subscription.Status | null): Plan {
	return status === "active" || status === "trialing" ? PLAN_TYPES.PRO : PLAN_TYPES.FREE;
}
