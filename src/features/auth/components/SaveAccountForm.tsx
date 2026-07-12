"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { convertGuestAccount } from "@/features/auth/actions";
import { convertAccountSchema, type ConvertAccountInput } from "@/features/auth/validators";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

// Guest → account conversion form. On success the guest's data is kept and a
// confirmation email is sent; we show that message in place of the form.
export function SaveAccountForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const form = useForm<ConvertAccountInput>({
		resolver: standardSchemaResolver(convertAccountSchema),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = (values: ConvertAccountInput) => {
		startTransition(async () => {
			const result = await convertGuestAccount(values);
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
				<Link href="/" className="text-sm font-medium text-primary hover:underline">
					{t("Auth.backToSignIn")}
				</Link>
			</div>
		);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<p className="text-sm text-foreground/60">{t("Auth.saveAccountDescription")}</p>

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

				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Auth.passwordLabel")}</FormLabel>
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
					{isPending ? t("Auth.savingAccount") : t("Auth.saveAccount")}
				</Button>
			</form>
		</Form>
	);
}
