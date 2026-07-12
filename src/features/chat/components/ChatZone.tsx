"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { UsageMeter } from "@/features/billing/components/UsageMeter";
import { getPlanLimits, formatTokens, type PlanUsage } from "@/features/billing/service";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatIcon, SendIcon } from "@/shared/assets/icons";
import { ChatMessage } from "@/features/chat/types";
import { SourceChips } from "./SourceChips";

export function ChatZone({
	documentId,
	plan,
	usage,
	className,
	scopeName,
	onSourceClick,
}: {
	documentId: string | null;
	plan: string;
	usage: PlanUsage;
	className?: string;
	scopeName: string;
	onSourceClick: (documentId: string, page: number | null) => void;
}) {
	const t = useT();
	const [input, setInput] = useState("");
	const { messages, sendMessage, status } = useChat<ChatMessage>({
		transport: new DefaultChatTransport({ api: "/api/chat" }),
		onError: () => toast.error(t("Workspace.chatError")),
	});
	const isBusy = status === "submitted" || status === "streaming";

	const limits = getPlanLimits(plan);
	const questionsThisSession = messages.filter((message) => message.role === "user").length;
	const isRequestCapped = limits.requestCap !== null;

	const usageUsed = isRequestCapped ? usage.requestsUsed + questionsThisSession : usage.tokensUsed;
	const usageMax = isRequestCapped ? limits.requestCap : limits.tokenBudget;
	const usagePercent = usageMax ? (usageUsed / usageMax) * 100 : 0;
	const usageMeterLabel = isRequestCapped
		? t("Workspace.questionsLabel")
		: t("Workspace.tokensLabel");
	const usageValueLabel = isRequestCapped
		? t("Workspace.usageQuestions", { used: usageUsed, max: usageMax ?? 0 })
		: t("Workspace.usageTokens", {
				used: formatTokens(usageUsed),
				max: usageMax !== null ? formatTokens(usageMax) : "∞",
			});

	const last = messages[messages.length - 1];
	const lastAssistantText =
		last?.role === "assistant"
			? last.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
			: "";
	const showTyping = isBusy && (last?.role !== "assistant" || lastAssistantText.length === 0);

	return (
		<section
			className={cn(
				"flex min-h-0 flex-col rounded-2xl border border-border bg-background shadow-sm",
				className,
			)}
		>
			<div className="shrink-0 space-y-2 border-b border-border px-4 py-2.5">
				<p className="truncate text-xs text-foreground/50">
					{t("Workspace.scope", { scope: scopeName })}
				</p>
				<UsageMeter label={usageMeterLabel} valueLabel={usageValueLabel} percent={usagePercent} />
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
				{messages.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
						<HugeiconsIcon icon={ChatIcon} className="size-8 text-foreground/30" />
						<p className="max-w-xs text-sm text-foreground/50">
							{documentId
								? t("Workspace.chatScopedDoc", { name: scopeName })
								: t("Workspace.chatScopedAll")}
						</p>
					</div>
				) : (
					messages.map((m) => {
						const text = m.parts
							.filter((p) => p.type === "text")
							.map((p) => p.text)
							.join("");
						const sources = m.parts.find((p) => p.type === "data-sources")?.data ?? [];
						return (
							<div
								key={m.id}
								className={cn(
									"flex flex-col gap-1",
									m.role === "user" ? "items-end" : "items-start",
								)}
							>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
										m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
									)}
								>
									{text}
								</div>
								{m.role === "assistant" && sources.length > 0 && (
									<SourceChips sources={sources} onSelect={onSourceClick} />
								)}
							</div>
						);
					})
				)}

				{showTyping && (
					<div className="flex max-w-[85%] items-center gap-1 self-start rounded-2xl bg-muted px-3 py-3 text-foreground/50">
						<span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-current" />
					</div>
				)}
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!input.trim()) return;
					sendMessage(
						{ text: input },
						{ body: { documentIds: documentId ? [documentId] : undefined } },
					);
					setInput("");
				}}
				className="border-t border-border p-3"
			>
				<div className="flex items-center gap-2 rounded-2xl border border-border bg-input/30 py-1 pr-1 pl-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t("Workspace.chatPlaceholder")}
						disabled={isBusy}
						className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
					/>
					<Button
						type="submit"
						size="icon-sm"
						disabled={isBusy || !input.trim()}
						aria-label={t("Workspace.send")}
					>
						<HugeiconsIcon icon={SendIcon} className="size-4" />
					</Button>
				</div>
			</form>
		</section>
	);
}
