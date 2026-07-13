"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import { stripe } from "@/features/billing/stripe";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/profile/validators";

export type ProfileResult = { error?: string; message?: string };

export async function changePassword(values: ChangePasswordInput): Promise<ProfileResult> {
	const parsed = changePasswordSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const t = await getTranslations();
	const supabase = await createClient();
	const user = await getCurrentUser();

	if (!user || !user.email) {
		return { error: "Not authenticated" };
	}

	const { error: verifyError } = await supabase.auth.signInWithPassword({
		email: user.email,
		password: parsed.data.currentPassword,
	});
	if (verifyError) {
		return { error: t("Profile.currentPasswordIncorrect") };
	}

	const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
	if (error) {
		return { error: error.message };
	}

	return { message: t("Profile.passwordUpdated") };
}

export async function cancelSubscription(): Promise<ProfileResult> {
	const t = await getTranslations();
	const supabase = await createClient();
	const user = await getCurrentUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("stripe_subscription_id")
		.eq("id", user.id)
		.single();

	if (!profile?.stripe_subscription_id) {
		return { error: t("Profile.noActiveSubscription") };
	}

	try {
		await stripe.subscriptions.update(profile.stripe_subscription_id, {
			cancel_at_period_end: true,
		});
	} catch (error) {
		console.error("cancelSubscription failed:", error);
		return { error: error instanceof Error ? error.message : t("Profile.cancelError") };
	}

	revalidatePath("/profile");
	return { message: t("Profile.cancelScheduled") };
}
