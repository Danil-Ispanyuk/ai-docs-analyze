import type { ReactNode } from "react";
import { Header } from "@/shared/components";

interface WorkspaceLayoutProps {
	isGuest: boolean;
	email: string;
	plan: string;
	children: ReactNode;
}

export function WorkspaceLayout({ isGuest, email, plan, children }: WorkspaceLayoutProps) {
	return (
		<div className="flex h-dvh flex-col">
			<Header isGuest={isGuest} email={email} plan={plan} />
			<main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 bg-muted/30 bg-[radial-gradient(48rem_28rem_at_100%_0%,var(--accent),transparent_60%)] p-3 md:grid-cols-[20rem_1fr_24rem] md:grid-rows-1 md:gap-4 md:p-4">
				{children}
			</main>
		</div>
	);
}
