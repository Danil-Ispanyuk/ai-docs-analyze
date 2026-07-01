"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signIn } from "@/actions/auth";
import { signInSchema, type SignInInput } from "@/lib/validators";
import { useT } from "@/i18n";
import { Button } from "@/elements/button";
import { Input } from "@/elements/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/elements/form";

export function SignInForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	const form = useForm<SignInInput>({
		resolver: standardSchemaResolver(signInSchema),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = (values: SignInInput) => {
		startTransition(async () => {
			const result = await signIn(values);
			if (result?.error) {
				form.setError("root", { message: result.error });
			}
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
								<Input type="password" autoComplete="current-password" {...field} />
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
					{isPending ? t("Auth.signingIn") : t("Auth.signIn")}
				</Button>

				<p className="text-center text-sm text-foreground/60">
					{t("Auth.noAccount")}{" "}
					<Link href="/sign-up" className="font-medium text-primary hover:underline">
						{t("Auth.signUp")}
					</Link>
				</p>
			</form>
		</Form>
	);
}
