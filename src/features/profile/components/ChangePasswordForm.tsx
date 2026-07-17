"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { changePassword } from "@/features/profile/actions";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/profile/validators";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { PasswordInput } from "@/shared/ui/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

export function ChangePasswordForm() {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	const form = useForm<ChangePasswordInput>({
		resolver: standardSchemaResolver(changePasswordSchema),
		defaultValues: { currentPassword: "", newPassword: "" },
	});

	const onSubmit = (values: ChangePasswordInput) => {
		startTransition(async () => {
			const result = await changePassword(values);
			if (result.error) {
				form.setError("root", { message: result.error });
				return;
			}
			toast.success(result.message ?? t("profile.passwordUpdated"));
			form.reset();
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
				<FormField
					control={form.control}
					name="currentPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("profile.currentPasswordLabel")}</FormLabel>
							<FormControl>
								<PasswordInput autoComplete="current-password" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="newPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("profile.newPasswordLabel")}</FormLabel>
							<FormControl>
								<PasswordInput autoComplete="new-password" {...field} />
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

				<Button type="submit" disabled={isPending}>
					{isPending && (
						<span
							className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
					)}
					{isPending ? t("profile.updatingPassword") : t("profile.updatePassword")}
				</Button>
			</form>
		</Form>
	);
}
