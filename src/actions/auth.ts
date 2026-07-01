"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validators";

// Result handed back to the react-hook-form submit handler. On success the
// action either redirects (sign-in) or returns a message (sign-up).
export type AuthResult = { error?: string; message?: string };

// Email + password sign-in. On success, redirects to the app root.
export async function signIn(values: SignInInput): Promise<AuthResult> {
  // Re-validate on the server: never trust the client even though RHF already
  // checked with the same schema.
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

// Email + password sign-up. Supabase sends a confirmation email that links
// back to /auth/callback (or /auth/confirm, depending on the email template).
export async function signUp(values: SignUpInput): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Stored in raw_user_meta_data; copied into profiles by the
      // handle_new_user trigger.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  const t = await getTranslations();
  return { message: t("Auth.emailConfirmation") };
}

// Signs the user out and returns them to the sign-in page.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/sign-in");
}
