"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { resetPassword } from "@/actions/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators";
import { useT } from "@/i18n";
import { Button } from "@/elements/button";
import { Input } from "@/elements/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/elements/form";

export function ResetPasswordForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	const form = useForm<ResetPasswordInput>({
		resolver: standardSchemaResolver(resetPasswordSchema),
		defaultValues: { password: "" },
	});

	// On success the action redirects to "/", so there's no success state to render.
	const onSubmit = (values: ResetPasswordInput) => {
		startTransition(async () => {
			const result = await resetPassword(values);
			if (result?.error) {
				form.setError("root", { message: result.error });
			}
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<p className="text-sm text-foreground/60">{t("Auth.resetPasswordDescription")}</p>

				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Auth.newPasswordLabel")}</FormLabel>
							<FormControl>
								<Input type="password" autoComplete="new-password" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{form.formState.errors.root && (
					<p className="text-sm text-destructive" role="alert">
						{form.formState.errors.root.message}
					</p>
				)}

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && (
						<span
							className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
					)}
					{isPending ? t("Auth.resettingPassword") : t("Auth.resetPassword")}
				</Button>
			</form>
		</Form>
	);
}
