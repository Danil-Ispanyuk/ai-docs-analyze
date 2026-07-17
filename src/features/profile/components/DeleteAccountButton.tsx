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
			const result = await deleteAccount({ password });
			if (result?.error) toast.error(result.error);
		});
	};

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button variant="destructive" size="sm">
						{t("profile.deleteAccount")}
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("profile.deleteModalTitle")}</DialogTitle>
				</DialogHeader>
				<DialogDescription>{t("profile.deleteModalDescription")}</DialogDescription>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="delete-password">{t("profile.deletePasswordLabel")}</Label>
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
							{t("profile.deleteConfirmLabel", { email })}
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
					<DialogClose render={<Button variant="outline">{t("profile.keepAccount")}</Button>} />
					<Button variant="destructive" onClick={handleDelete} disabled={isPending || !canDelete}>
						{isPending && (
							<span
								className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								aria-hidden
							/>
						)}
						{t("profile.confirmDelete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
