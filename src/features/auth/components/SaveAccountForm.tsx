"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { convertGuestAccount } from "@/features/auth/actions";
import { convertAccountSchema, type ConvertAccountInput } from "@/features/auth/validators";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

export function SaveAccountForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	const form = useForm<ConvertAccountInput>({
		resolver: standardSchemaResolver(convertAccountSchema),
		defaultValues: { fullName: "", email: "", password: "" },
	});

	const onSubmit = (values: ConvertAccountInput) => {
		startTransition(async () => {
			const result = await convertGuestAccount(values);
			if (result?.error) {
				form.setError("root", { message: result.error });
			}
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<p className="text-sm text-foreground/60">{t("auth.saveAccountDescription")}</p>

				<FormField
					control={form.control}
					name="fullName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("auth.fullNameLabel")}</FormLabel>
							<FormControl>
								<Input
									type="text"
									autoComplete="name"
									placeholder={t("auth.fullNamePlaceholder")}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

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

				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("auth.passwordLabel")}</FormLabel>
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
							className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
					)}
					{isPending ? t("auth.savingAccount") : t("auth.saveAccount")}
				</Button>
			</form>
		</Form>
	);
}
