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
				<p className="text-sm text-foreground/60">{t("auth.forgotPasswordDescription")}</p>

				{expired && !rootError && (
					<p className="text-sm text-destructive" role="alert">
						{t("auth.recoveryLinkExpired")}
					</p>
				)}

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("auth.emailLabel")}</FormLabel>
							<FormControl>
								<Input
									type="email"
									autoComplete="email"
									placeholder={t("auth.emailPlaceholder")}
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
							className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
					)}
					{isPending ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
				</Button>

				<p className="text-center text-sm text-foreground/60">
					<Link href="/sign-in" className="font-medium text-primary hover:underline">
						{t("auth.backToSignIn")}
					</Link>
				</p>
			</form>
		</Form>
	);
}
