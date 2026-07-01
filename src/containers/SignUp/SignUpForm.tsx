"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signUp } from "@/actions/auth";
import { signUpSchema, type SignUpInput } from "@/lib/validators";
import { useT } from "@/i18n";
import { Button } from "@/elements/button";
import { Input } from "@/elements/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/elements/form";

export function SignUpForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const form = useForm<SignUpInput>({
		resolver: standardSchemaResolver(signUpSchema),
		defaultValues: { fullName: "", email: "", password: "" },
	});

	const onSubmit = (values: SignUpInput) => {
		startTransition(async () => {
			const result = await signUp(values);
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
					{t("Auth.signIn")}
				</Link>
			</div>
		);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					control={form.control}
					name="fullName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Auth.fullNameLabel")}</FormLabel>
							<FormControl>
								<Input
									type="text"
									autoComplete="name"
									placeholder={t("Auth.fullNamePlaceholder")}
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
					{isPending ? t("Auth.signingUp") : t("Auth.signUp")}
				</Button>

				<p className="text-center text-sm text-foreground/60">
					{t("Auth.existAccount")}{" "}
					<Link href="/sign-in" className="font-medium text-primary hover:underline">
						{t("Auth.signIn")}
					</Link>
				</p>
			</form>
		</Form>
	);
}
