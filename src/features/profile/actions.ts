"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import { stripe } from "@/features/billing/stripe";
import { DOCUMENTS_BUCKET } from "@/features/documents/service";
import {
	changePasswordSchema,
	deleteAccountSchema,
	type ChangePasswordInput,
	type DeleteAccountInput,
} from "@/features/profile/validators";

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

export async function deleteAccount(values: DeleteAccountInput): Promise<ProfileResult> {
	const parsed = deleteAccountSchema.safeParse(values);
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
		password: parsed.data.password,
	});
	if (verifyError) {
		return { error: t("Profile.deletePasswordIncorrect") };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("stripe_subscription_id")
		.eq("id", user.id)
		.single();
	if (profile?.stripe_subscription_id) {
		try {
			await stripe.subscriptions.cancel(profile.stripe_subscription_id);
		} catch (error) {
			console.error("deleteAccount: Stripe cancel failed:", error);
		}
	}

	const { data: documents, error: documentsError } = await supabase
		.from("documents")
		.select("storage_path")
		.eq("user_id", user.id);
	if (documentsError) {
		return { error: documentsError.message };
	}

	const storagePaths = (documents ?? [])
		.map((document) => document.storage_path)
		.filter((path): path is string => Boolean(path));
	if (storagePaths.length > 0) {
		const { error: storageError } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.remove(storagePaths);
		if (storageError) {
			return { error: storageError.message };
		}
	}

	const { error: deleteError } = await supabase.rpc("delete_current_user");
	if (deleteError) {
		return { error: deleteError.message };
	}

	await supabase.auth.signOut();

	revalidatePath("/", "layout");
	redirect("/");
}
