"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSubscription } from "@/features/profile/actions";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
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

export function CancelSubscriptionButton() {
	const t = useT();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const handleCancel = () => {
		startTransition(async () => {
			const result = await cancelSubscription();
			if (result.error) {
				toast.error(result.error);
				return;
			}
			toast.success(result.message ?? t("profile.cancelScheduled"));
			router.refresh();
		});
	};

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button variant="destructive" size="sm">
						{t("profile.cancelSubscription")}
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("profile.cancelModalTitle")}</DialogTitle>
				</DialogHeader>
				<DialogDescription>{t("profile.cancelModalDescription")}</DialogDescription>
				<DialogFooter className="sm:justify-end">
					<DialogClose
						render={<Button variant="outline">{t("profile.keepSubscription")}</Button>}
					/>
					<Button variant="destructive" onClick={handleCancel} disabled={isPending}>
						{isPending && (
							<span
								className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								aria-hidden
							/>
						)}
						{t("profile.confirmCancel")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
