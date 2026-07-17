"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/shared/config/supabase/server";
import {
	signInSchema,
	signUpSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	convertAccountSchema,
	type SignInInput,
	type SignUpInput,
	type ForgotPasswordInput,
	type ResetPasswordInput,
	type ConvertAccountInput,
} from "@/features/auth/validators";
import { getCurrentUser } from "@/features/auth/service";
import { PLAN_TYPES } from "@/shared/constants/general";

export type AuthResult = { error?: string; message?: string };

export async function signIn(values: SignInInput): Promise<AuthResult> {
	const parsed = signInSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword(parsed.data);

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
}

export async function signUp(values: SignUpInput): Promise<AuthResult> {
	const parsed = signUpSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const supabase = await createClient();

	const { error } = await supabase.auth.signUp({
		email: parsed.data.email,
		password: parsed.data.password,
		options: {
			data: { full_name: parsed.data.fullName },
		},
	});

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
}

export async function requestPasswordReset(values: ForgotPasswordInput): Promise<AuthResult> {
	const parsed = forgotPasswordSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const origin = (await headers()).get("origin");
	const supabase = await createClient();

	await supabase.auth.resetPasswordForEmail(parsed.data.email, {
		redirectTo: `${origin}/auth/confirm?next=/reset-password`,
	});

	const t = await getTranslations();
	return { message: t("auth.resetLinkSent") };
}

export async function resetPassword(values: ResetPasswordInput): Promise<AuthResult> {
	const parsed = resetPasswordSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const supabase = await createClient();
	const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
}

export async function signInAnonymously(): Promise<AuthResult> {
	const supabase = await createClient();
	const { error } = await supabase.auth.signInAnonymously();

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
}

export async function convertGuestAccount(values: ConvertAccountInput): Promise<AuthResult> {
	const parsed = convertAccountSchema.safeParse(values);
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	const supabase = await createClient();
	const user = await getCurrentUser();

	if (!user) {
		return { error: "Not authenticated" };
	}
	if (!user.is_anonymous) {
		return { error: "Your account is already registered." };
	}

	const { error } = await supabase.auth.updateUser({
		email: parsed.data.email,
		password: parsed.data.password,
		data: { full_name: parsed.data.fullName },
	});
	if (error) {
		return { error: error.message };
	}

	await supabase
		.from("profiles")
		.update({ full_name: parsed.data.fullName, plan: PLAN_TYPES.FREE })
		.eq("id", user.id);

	revalidatePath("/", "layout");
	redirect("/");
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();

	revalidatePath("/", "layout");
	redirect("/");
}
