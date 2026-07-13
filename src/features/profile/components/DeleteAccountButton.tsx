"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/features/profile/actions";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/dialog";

interface DeleteAccountButtonProps {
	email: string;
}

export function DeleteAccountButton({ email }: DeleteAccountButtonProps) {
	const t = useT();
	const [isPending, startTransition] = useTransition();
	const [password, setPassword] = useState("");
	const [confirmEmail, setConfirmEmail] = useState("");

	const canDelete =
		password.length > 0 && confirmEmail.trim().toLowerCase() === email.toLowerCase();

	const handleDelete = () => {
		if (!canDelete) return;
		startTransition(async () => {
			// On success the action redirects to "/"; only an error returns here.
			const result = await deleteAccount({ password });
			if (result?.error) toast.error(result.error);
		});
	};

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button variant="destructive" size="sm">
						{t("Profile.deleteAccount")}
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Profile.deleteModalTitle")}</DialogTitle>
				</DialogHeader>
				<DialogDescription>{t("Profile.deleteModalDescription")}</DialogDescription>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="delete-password">{t("Profile.deletePasswordLabel")}</Label>
						<Input
							id="delete-password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="delete-confirm-email">
							{t("Profile.deleteConfirmLabel", { email })}
						</Label>
						<Input
							id="delete-confirm-email"
							type="email"
							autoComplete="off"
							placeholder={email}
							value={confirmEmail}
							onChange={(event) => setConfirmEmail(event.target.value)}
						/>
					</div>
				</div>

				<DialogFooter className="sm:justify-end">
					<DialogClose render={<Button variant="outline">{t("Profile.keepAccount")}</Button>} />
					<Button variant="destructive" onClick={handleDelete} disabled={isPending || !canDelete}>
						{isPending && (
							<span
								className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								aria-hidden
							/>
						)}
						{t("Profile.confirmDelete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
