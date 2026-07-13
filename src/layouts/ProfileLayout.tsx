import type { ReactNode } from "react";
import { Header } from "@/shared/components";

interface ProfileLayoutProps {
	isGuest: boolean;
	email: string;
	plan: string;
	children: ReactNode;
}

export function ProfileLayout({ isGuest, email, plan, children }: ProfileLayoutProps) {
	return (
		<div className="flex h-dvh flex-col">
			<Header isGuest={isGuest} email={email} plan={plan} />
			<main className="min-h-0 flex-1 overflow-y-auto bg-muted/30">{children}</main>
		</div>
	);
}
