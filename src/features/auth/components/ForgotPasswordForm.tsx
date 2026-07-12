"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { requestPasswordReset } from "@/features/auth/actions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/validators";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

// `expired` is set when the user arrived here from an invalid/expired recovery
// link (see src/app/auth/confirm/route.ts) and needs to request a new one.
export function ForgotPasswordForm({ expired }: { expired?: boolean }) {
	const t = useT();
	const [isPending, startTransition] = useTransition();

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
				toast.success(result.message);
				form.reset();
			}
		});
	};

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
