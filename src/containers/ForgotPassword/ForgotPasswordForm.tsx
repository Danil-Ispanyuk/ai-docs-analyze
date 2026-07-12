"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { requestPasswordReset } from "@/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators";
import { useT } from "@/i18n";
import { Button } from "@/elements/button";
import { Input } from "@/elements/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/elements/form";

// `expired` is set when the user arrived here from an invalid/expired recovery
// link (see src/app/auth/confirm/route.ts) and needs to request a new one.
export function ForgotPasswordForm({ expired }: { expired?: boolean }) {
	const t = useT();
	const [isPending, startTransition] = useTransition();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const form = useForm<ForgotPasswordInput>({
		resolver: standardSchemaResolver(forgotPasswordSchema),
		defaultValues: { email: "" },
	});

	const onSubmit = (values: ForgotPasswordInput) => {
		startTransition(async () => {
			const result = await requestPasswordReset(values);
			if (result?.error) {
				form.setError("root", { message: result.error });
			} else if (result?.message) {
				setSuccessMessage(result.message);
			}
		});
	};

	if (successMessage) {
		return (
			<div className="space-y-4 text-center">
				<p className="text-sm text-foreground/80">{successMessage}</p>
				<Link href="/sign-in" className="text-sm font-medium text-primary hover:underline">
					{t("Auth.backToSignIn")}
				</Link>
			</div>
		);
	}

	const rootError = form.formState.errors.root?.message;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<p className="text-sm text-foreground/60">{t("Auth.forgotPasswordDescription")}</p>

				{expired && !rootError && (
					<p className="text-sm text-destructive" role="alert">
						{t("Auth.recoveryLinkExpired")}
					</p>
				)}

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Auth.emailLabel")}</FormLabel>
							<FormControl>
								<Input
									type="email"
									autoComplete="email"
									placeholder={t("Auth.emailPlaceholder")}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{rootError && (
					<p className="text-sm text-destructive" role="alert">
						{rootError}
					</p>
				)}

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && (
						<span
							className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
					)}
					{isPending ? t("Auth.sendingResetLink") : t("Auth.sendResetLink")}
				</Button>

				<p className="text-center text-sm text-foreground/60">
					<Link href="/sign-in" className="font-medium text-primary hover:underline">
						{t("Auth.backToSignIn")}
					</Link>
				</p>
			</form>
		</Form>
	);
}
