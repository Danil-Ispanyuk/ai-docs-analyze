"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { UsageMeter } from "@/features/billing/components/UsageMeter";
import {
	getPlanLimits,
	formatTokens,
	getNextUsageResetMs,
	type PlanUsage,
} from "@/features/billing/service";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatIcon, SendIcon } from "@/shared/assets/icons";
import { ChatMessage, type ChatScope } from "@/features/chat/types";
import { getChatMessages, clearChatMessages } from "@/features/chat/actions";
import { SourceChips } from "./SourceChips";

export function ChatZone({
	scope,
	plan,
	usage,
	className,
	scopeName,
	initialMessages,
	onSourceClick,
	disabledReason,
}: {
	scope: ChatScope;
	plan: string;
	usage: PlanUsage;
	className?: string;
	scopeName: string;
	initialMessages: ChatMessage[];
	onSourceClick: (documentId: string, page: number | null) => void;
	disabledReason?: string | null;
}) {
	const t = useT();
	const [input, setInput] = useState("");
	const [sessionTokens, setSessionTokens] = useState(0);
	const [sentThisSession, setSentThisSession] = useState(0);
	const [now, setNow] = useState(() => Date.now());
	const inputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { messages, sendMessage, setMessages, status } = useChat<ChatMessage>({
		transport: new DefaultChatTransport({ api: "/api/chat" }),
		messages: initialMessages,
		onError: () => toast.error(t("Workspace.chatError")),
		onFinish: ({ message }) => {
			const tokens = message.metadata?.tokens;
			if (tokens) setSessionTokens((previous) => previous + tokens);
		},
	});
	const isBusy = status === "submitted" || status === "streaming";
	const isInputDisabled = isBusy || Boolean(disabledReason);
	const [isClearing, startClear] = useTransition();

	const handleClearChat = () => {
		startClear(async () => {
			const result = await clearChatMessages(scope);
			if (result?.error) {
				toast.error(t("Workspace.chatError"));
				return;
			}
			setMessages([]);
		});
	};

	const isInitialScope = useRef(true);
	const limits = getPlanLimits(plan);
	const isRequestCapped = limits.requestCap !== null;

	const usageUsed = isRequestCapped
		? usage.requestsUsed + sentThisSession
		: usage.tokensUsed + sessionTokens;
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

	const minutesUntilReset = Math.max(1, Math.ceil((getNextUsageResetMs(now) - now) / 60_000));
	const resetHint =
		minutesUntilReset >= 60
			? t("Workspace.usageResetsInHours", {
					hours: Math.floor(minutesUntilReset / 60),
					minutes: minutesUntilReset % 60,
				})
			: t("Workspace.usageResetsInMinutes", { minutes: minutesUntilReset });

	const last = messages[messages.length - 1];
	const lastAssistantText =
		last?.role === "assistant"
			? last.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
			: "";
	const showTyping = isBusy && (last?.role !== "assistant" || lastAssistantText.length === 0);

	useEffect(() => {
		if (isInitialScope.current) {
			isInitialScope.current = false;
			return;
		}
		let active = true;
		getChatMessages(scope).then((loaded) => {
			if (active) setMessages(loaded);
		});
		return () => {
			active = false;
		};
	}, [scope, setMessages]);

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ block: "end" });
	}, [messages, status, lastAssistantText, showTyping]);

	return (
		<section
			className={cn(
				"flex min-h-0 flex-col rounded-2xl border border-border bg-background shadow-sm",
				className,
			)}
		>
			<div className="shrink-0 space-y-2 border-b border-border px-4 py-2.5">
				<div className="flex items-center justify-between gap-2">
					<p className="min-w-0 flex-1 truncate text-xs text-foreground/50">
						{t("Workspace.scope", { scope: scopeName })}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={messages.length === 0 || isBusy || isClearing}
						onClick={handleClearChat}
						className="h-auto shrink-0 px-2 py-1 text-xs text-foreground/50 hover:text-destructive"
					>
						{t("Workspace.clearChat")}
					</Button>
				</div>
				<UsageMeter
					label={usageMeterLabel}
					valueLabel={usageValueLabel}
					percent={usagePercent}
					hint={resetHint}
				/>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
				{messages.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
						<HugeiconsIcon icon={ChatIcon} className="size-8 text-foreground/30" />
						<p className="text-sm font-medium text-foreground/70">
							{t("Workspace.chatWelcomeTitle")}
						</p>
						<p className="max-w-sm text-sm text-foreground/50">{t("Workspace.chatWelcomeBody")}</p>
						<p className="max-w-xs text-xs text-foreground/40">
							{scope.documentId
								? t("Workspace.chatScopedDoc", { name: scopeName })
								: scope.folderId
									? t("Workspace.chatScopedFolder", { name: scopeName })
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
				<div ref={messagesEndRef} aria-hidden />
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (disabledReason) return;
					if (!input.trim()) return;
					sendMessage(
						{ text: input },
						{
							body: {
								documentId: scope.documentId ?? undefined,
								folderId: scope.folderId ?? undefined,
							},
						},
					);
					setSentThisSession((previous) => previous + 1);
					setInput("");
					inputRef.current?.focus();
				}}
				className="border-t border-border p-3"
			>
				{disabledReason && (
					<p className="mb-2 text-xs leading-relaxed text-destructive">{disabledReason}</p>
				)}
				<div className="flex items-center gap-2 rounded-2xl border border-border bg-input/30 py-1 ps-3 pe-1 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
					<input
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t("Workspace.chatPlaceholder")}
						disabled={isInputDisabled}
						className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
					/>
					<Button
						type="submit"
						size="icon-sm"
						disabled={isInputDisabled || !input.trim()}
						aria-label={t("Workspace.send")}
					>
						<HugeiconsIcon icon={SendIcon} className="size-4 rtl:-scale-x-100" />
					</Button>
				</div>
			</form>
		</section>
	);
}
